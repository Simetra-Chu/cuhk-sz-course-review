import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { createAdminClient } from "../lib/supabase/admin";
import type { NormalizedCourse } from "../types/course-data";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const DATA_DIR = path.resolve(process.cwd(), "data");
const COURSES_PATH = path.join(DATA_DIR, "courses.json");
const STALE_PATH = path.join(DATA_DIR, "sis-import-stale.json");
const APPLY = process.argv.includes("--apply");
const PAGE_SIZE = 1_000;
const UPSERT_BATCH_SIZE = 200;

type ExistingCourse = {
  code: string;
  name_cn: string;
  name_en: string | null;
  school: string;
  subject_code: string | null;
  subject_name: string | null;
  source: string;
  source_url: string | null;
  offered_terms: string[];
};

async function loadExistingCourses() {
  const supabase = createAdminClient();
  const all: ExistingCourse[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("courses")
      .select(
        "code,name_cn,name_en,school,subject_code,subject_name,source,source_url,offered_terms"
      )
      .order("code")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      if (
        error.message.includes("subject_code") ||
        error.message.includes("offered_terms")
      ) {
        throw new Error(
          "数据库还没有 Phase 2 字段。请先在 Supabase SQL Editor 运行 supabase/phase2-course-source.sql。"
        );
      }
      throw error;
    }

    all.push(...((data ?? []) as ExistingCourse[]));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return all;
}

function sameCourse(a: ExistingCourse, b: ExistingCourse) {
  return (
    a.name_cn === b.name_cn &&
    a.name_en === b.name_en &&
    a.school === b.school &&
    a.subject_code === b.subject_code &&
    a.subject_name === b.subject_name &&
    a.source === b.source &&
    a.source_url === b.source_url &&
    JSON.stringify(a.offered_terms) === JSON.stringify(b.offered_terms)
  );
}

async function main() {
  const courses = JSON.parse(
    await readFile(COURSES_PATH, "utf8")
  ) as NormalizedCourse[];

  if (!Array.isArray(courses) || courses.length === 0) {
    throw new Error("data/courses.json 为空，请先完成 PDF 提取和清洗。");
  }
  if (courses.length < 100 && process.env.ALLOW_SMALL_DATASET !== "1") {
    throw new Error(
      `标准化数据仅 ${courses.length} 门，已阻止导入。开发测试可设置 ALLOW_SMALL_DATASET=1。`
    );
  }

  const existing = await loadExistingCourses();
  const existingMap = new Map(existing.map((course) => [course.code, course]));
  const incomingCodes = new Set(courses.map((course) => course.code));

  const payload = courses.map(({ mapping_reason: _, ...course }) => {
    const current = existingMap.get(course.code);
    const existingHasTranslation =
      current?.name_cn &&
      current.name_en &&
      current.name_cn.toLocaleLowerCase() !==
        current.name_en.toLocaleLowerCase();

    return {
      ...course,
      // 保留数据库中已经人工校对的中文名。
      name_cn: existingHasTranslation ? current.name_cn : course.name_cn,
    };
  });

  const added = payload.filter((course) => !existingMap.has(course.code));
  const updated = payload.filter((course) => {
    const current = existingMap.get(course.code);
    return current ? !sameCourse(current, course) : false;
  });
  const unchanged = payload.length - added.length - updated.length;
  const stale = existing.filter((course) => !incomingCodes.has(course.code));

  await writeFile(
    STALE_PATH,
    JSON.stringify(
      stale.map((course) => ({
        code: course.code,
        name_cn: course.name_cn,
        source: course.source,
      })),
      null,
      2
    ),
    "utf8"
  );

  console.log(APPLY ? "导入模式：APPLY" : "导入模式：DRY RUN（不会写数据库）");
  console.log(`PDF 课程数据：${payload.length}`);
  console.log(`新增：${added.length}`);
  console.log(`更新：${updated.length}`);
  console.log(`不变：${unchanged}`);
  console.log(`数据库中未出现在本次 PDF 数据：${stale.length}（不会自动删除）`);
  console.log(`stale 报告：${STALE_PATH}`);

  if (!APPLY) {
    console.log("\n确认统计合理后，运行：npm run import:courses -- --apply");
    return;
  }

  const supabase = createAdminClient();
  for (let start = 0; start < payload.length; start += UPSERT_BATCH_SIZE) {
    const batch = payload.slice(start, start + UPSERT_BATCH_SIZE);
    const { error } = await supabase
      .from("courses")
      .upsert(batch, { onConflict: "code" });
    if (error) throw error;
    console.log(
      `已写入 ${Math.min(start + batch.length, payload.length)}/${payload.length}`
    );
  }

  console.log("课程导入完成。既有评价、课程 UUID 和评分统计均已保留。");
}

main().catch((error) => {
  console.error("课程导入失败：", error);
  process.exitCode = 1;
});
