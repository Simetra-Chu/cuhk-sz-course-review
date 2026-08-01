import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NormalizedCourse, PdfRawCourse } from "../types/course-data";

const DATA_DIR = path.resolve(process.cwd(), "data");
const RAW_PATH = path.join(DATA_DIR, "pdf-courses.raw.json");
const OUTPUT_PATH = path.join(DATA_DIR, "courses.json");
const CONFLICTS_PATH = path.join(DATA_DIR, "pdf-title-conflicts.json");
const COURSE_CODE_PATTERN = /^[A-Z]{2,5}\d{4}[A-Z]?$/;

function cleanText(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

async function main() {
  const raw = JSON.parse(
    await readFile(RAW_PATH, "utf8")
  ) as PdfRawCourse[];

  if (!Array.isArray(raw)) {
    throw new Error("PDF 原始数据格式错误：顶层必须是数组。");
  }

  if (raw.length < 100 && process.env.ALLOW_SMALL_DATASET !== "1") {
    throw new Error(
      `仅提取到 ${raw.length} 条课程，数量异常，已停止清洗。开发测试可设置 ALLOW_SMALL_DATASET=1。`
    );
  }

  const normalizedMap = new Map<string, NormalizedCourse>();
  const conflictingTitles: Array<{
    code: string;
    titles: string[];
    terms: string[];
  }> = [];
  const syncedAt = new Date().toISOString();

  for (const item of raw) {
    const code = cleanText(item.code).replace(/\s+/g, "").toUpperCase();
    const title = cleanText(item.title);
    const subjectCode = code.match(/^[A-Z]+/)?.[0] ?? "";

    if (!COURSE_CODE_PATTERN.test(code)) {
      throw new Error(`课程代码格式异常：${item.code}`);
    }
    if (title.length < 2) {
      throw new Error(`课程 ${code} 的标题为空或过短。`);
    }
    if (!/^[A-Z]{2,5}$/.test(subjectCode)) {
      throw new Error(`课程 ${code} 的学科代码异常：${subjectCode}`);
    }

    const normalized: NormalizedCourse = {
      code,
      // 开课文件只提供英文标题；中文名缺失时先使用英文标题展示。
      name_cn: title,
      name_en: title,
      school: item.school,
      subject_code: subjectCode,
      subject_name: subjectCode,
      source: "registry",
      source_url: null,
      offered_terms: [item.term],
      prerequisite: item.prerequisite,
      corequisite: item.corequisite,
      exclusion: item.exclusion,
      last_synced_at: syncedAt,
      mapping_reason: "pdf-department",
    };

    const previous = normalizedMap.get(code);
    if (previous && previous.name_en !== normalized.name_en) {
      conflictingTitles.push({
        code,
        titles: [
          previous.name_en ?? previous.name_cn,
          normalized.name_en ?? normalized.name_cn,
        ],
        terms: [...previous.offered_terms, item.term],
      });
    }
    if (previous) {
      normalized.offered_terms = Array.from(
        new Set([...previous.offered_terms, item.term])
      );
      // 跨学期合并：有内容的学期覆盖空值；两边都有时采用较新学期。
      normalized.prerequisite =
        normalized.prerequisite ?? previous.prerequisite;
      normalized.corequisite = normalized.corequisite ?? previous.corequisite;
      normalized.exclusion = normalized.exclusion ?? previous.exclusion;
    }
    normalizedMap.set(code, normalized);
  }

  const courses = Array.from(normalizedMap.values()).sort((a, b) =>
    a.code.localeCompare(b.code)
  );

  await Promise.all([
    writeFile(OUTPUT_PATH, JSON.stringify(courses, null, 2), "utf8"),
    writeFile(
      CONFLICTS_PATH,
      JSON.stringify(conflictingTitles, null, 2),
      "utf8"
    ),
  ]);

  const schoolCounts = courses.reduce<Record<string, number>>(
    (counts, course) => {
      counts[course.school] = (counts[course.school] ?? 0) + 1;
      return counts;
    },
    {}
  );

  console.log(`清洗完成：${raw.length} 条原始记录 → ${courses.length} 门课程`);
  console.log("学院统计：", schoolCounts);
  console.log(`跨学期标题变化：${conflictingTitles.length} 门（采用较新学期标题）`);
  console.log(`标准化数据：${OUTPUT_PATH}`);
  console.log(`标题变化报告：${CONFLICTS_PATH}`);
  console.log("下一步运行：npm run import:courses");
}

main().catch((error) => {
  console.error("课程清洗失败：", error);
  process.exitCode = 1;
});
