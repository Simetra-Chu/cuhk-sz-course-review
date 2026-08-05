/**
 * 导入同义改写后的飞书评价
 * - comments → discussion_posts（含 tags）
 * - 正面教授评价 → professor_recommendations
 *
 *   npx tsx scripts/import-feishu-transformed.ts [transformed.json]
 *   npx tsx scripts/import-feishu-transformed.ts --apply [transformed.json]
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { createAdminClient } from "../lib/supabase/admin";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const APPLY = process.argv.includes("--apply");
const AUTHOR_USER_ID = "20feb4f8-023f-43db-8ae1-d31cba672dbc";
const SCRAPE_DIR = path.resolve(process.cwd(), "data", "feishu-scrapes");

const COURSE_CODE_MAP: Record<string, string> = {
  GFN: "GFN1000",
  CEC2001: "GEA2000",
  "1002B": "MAT1002",
};

type TransformedFile = {
  comments: Array<{
    course_code: string;
    content: string;
    tags: string[];
    professor: string | null;
  }>;
  professor_recommendations: Array<{
    course_code: string;
    professor_name: string;
    content: string;
  }>;
};

function resolveCode(raw: string) {
  const code = raw.trim().replace(/\s+/g, "").toUpperCase();
  return COURSE_CODE_MAP[code] ?? code;
}

async function latestTransformed(explicit?: string) {
  if (explicit) return path.resolve(process.cwd(), explicit);
  const files = (await readdir(SCRAPE_DIR))
    .filter((f) => f.startsWith("transformed-") && f.endsWith(".json"))
    .sort();
  if (!files.length) throw new Error("未找到 transformed-*.json，请先运行 transform");
  return path.join(SCRAPE_DIR, files[files.length - 1]);
}

async function main() {
  const explicit = process.argv.find(
    (a, idx) => idx >= 2 && a !== "--apply" && !a.startsWith("--")
  );
  const file = await latestTransformed(explicit);
  console.log(`输入：${file}`);
  const data = JSON.parse(await readFile(file, "utf8")) as TransformedFile;

  const supabase = createAdminClient();
  const needed = Array.from(
    new Set(
      [
        ...data.comments.map((c) => resolveCode(c.course_code)),
        ...data.professor_recommendations.map((c) => resolveCode(c.course_code)),
      ].filter(Boolean)
    )
  );

  const { data: courses, error: courseError } = await supabase
    .from("courses")
    .select("id, code")
    .in("code", needed);
  if (courseError) throw courseError;

  const idByCode = new Map(
    (courses ?? []).map((c) => [c.code as string, c.id as string])
  );
  const missing = needed.filter((c) => !idByCode.has(c));
  if (missing.length) {
    console.warn(`跳过缺失课程 ${missing.length} 个：`, missing.slice(0, 20));
  }

  const { data: existingPosts } = await supabase
    .from("discussion_posts")
    .select("content, course_id")
    .eq("user_id", AUTHOR_USER_ID);

  const existingBodies = new Set(
    (existingPosts ?? []).map(
      (p) => `${p.course_id}::${String(p.content).trim()}`
    )
  );

  const commentsToInsert = [];
  for (const row of data.comments) {
    const code = resolveCode(row.course_code);
    const courseId = idByCode.get(code);
    if (!courseId) continue;
    const content = row.content.trim();
    if (!content) continue;
    if (existingBodies.has(`${courseId}::${content}`)) continue;
    commentsToInsert.push({
      course_id: courseId,
      user_id: AUTHOR_USER_ID,
      parent_id: null,
      content,
      tags: (row.tags ?? []).slice(0, 8),
    });
  }

  const { data: existingRecs } = await supabase
    .from("professor_recommendations")
    .select("id, course_id, professor_name, content")
    .eq("user_id", AUTHOR_USER_ID);

  const recsToInsert = [];
  const recsToUpdate: Array<{ id: string; content: string }> = [];

  for (const row of data.professor_recommendations) {
    const code = resolveCode(row.course_code);
    const courseId = idByCode.get(code);
    if (!courseId) continue;
    const name = row.professor_name.trim();
    if (name.length < 2) continue;
    const content = row.content.trim();
    if (!content) continue;

    const existing = (existingRecs ?? []).find(
      (r) =>
        r.course_id === courseId &&
        String(r.professor_name).trim().toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      const old = String(existing.content);
      if (old.includes(content)) continue;
      recsToUpdate.push({
        id: existing.id as string,
        content: `${old}\n\n——\n\n${content}`.slice(0, 2000),
      });
    } else {
      recsToInsert.push({
        course_id: courseId,
        user_id: AUTHOR_USER_ID,
        professor_name: name.slice(0, 40),
        content: content.slice(0, 2000),
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "apply" : "dry-run",
        commentsToInsert: commentsToInsert.length,
        professorRecsToInsert: recsToInsert.length,
        professorRecsToUpdate: recsToUpdate.length,
        missingCourses: missing.length,
        sampleComment: commentsToInsert[0] ?? null,
        sampleRec: recsToInsert[0] ?? null,
      },
      null,
      2
    )
  );

  if (!APPLY) {
    console.log("预览完成。加 --apply 才会写入。");
    return;
  }

  // 分批插入评论
  const BATCH = 50;
  for (let i = 0; i < commentsToInsert.length; i += BATCH) {
    const chunk = commentsToInsert.slice(i, i + BATCH);
    const { error } = await supabase.from("discussion_posts").insert(chunk);
    if (error) {
      // tags 列可能尚未迁移
      if (/tags/i.test(error.message)) {
        throw new Error(
          `写入失败（可能未跑 phase9-discussion-tags.sql）：${error.message}`
        );
      }
      throw error;
    }
  }

  if (recsToInsert.length) {
    const { error } = await supabase
      .from("professor_recommendations")
      .insert(recsToInsert);
    if (error) throw error;
  }

  for (const rec of recsToUpdate) {
    const { error } = await supabase
      .from("professor_recommendations")
      .update({ content: rec.content })
      .eq("id", rec.id);
    if (error) throw error;
  }

  console.log("导入完成。");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
