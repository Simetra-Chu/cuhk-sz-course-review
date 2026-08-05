/**
 * 清理样例误入「评论区」的飞书教授向内容，并按新规则只导入教授评价
 *
 *   npx tsx scripts/reimport-feishu-professor-only.ts
 *   npx tsx scripts/reimport-feishu-professor-only.ts --apply
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { createAdminClient } from "../lib/supabase/admin";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const APPLY = process.argv.includes("--apply");
const AUTHOR_USER_ID = "20feb4f8-023f-43db-8ae1-d31cba672dbc";
const SAMPLE_CODES = ["ACT2111", "ENG1001", "ACT3154"];
const SCRAPE_DIR = path.resolve(process.cwd(), "data", "feishu-scrapes");

async function latestTransformed() {
  const files = (await readdir(SCRAPE_DIR))
    .filter((f) => f.startsWith("transformed-") && f.endsWith(".json"))
    .sort();
  if (!files.length) throw new Error("没有 transformed 文件，请先 transform");
  return path.join(SCRAPE_DIR, files[files.length - 1]);
}

async function main() {
  // 先用 sample 重新 transform
  const { spawnSync } = await import("node:child_process");
  const transform = spawnSync(
    "npx",
    ["tsx", "scripts/transform-feishu-reviews.ts", "data/feishu-scrapes/sample-manual.json"],
    { cwd: process.cwd(), encoding: "utf8", shell: true }
  );
  console.log(transform.stdout);
  if (transform.status !== 0) {
    console.error(transform.stderr);
    throw new Error("transform failed");
  }

  const file = await latestTransformed();
  const data = JSON.parse(await readFile(file, "utf8")) as {
    professor_recommendations: Array<{
      course_code: string;
      professor_name: string;
      content: string;
    }>;
    stats: unknown;
  };
  console.log("transform stats", data.stats);

  const supabase = createAdminClient();
  const { data: courses } = await supabase
    .from("courses")
    .select("id, code")
    .in("code", SAMPLE_CODES);
  const idByCode = new Map(
    (courses ?? []).map((c) => [c.code as string, c.id as string])
  );
  const courseIds = SAMPLE_CODES.map((c) => idByCode.get(c)).filter(
    Boolean
  ) as string[];

  const { data: posts } = await supabase
    .from("discussion_posts")
    .select("id, content, course_id, created_at")
    .eq("user_id", AUTHOR_USER_ID)
    .in("course_id", courseIds)
    .gte("created_at", "2026-08-04T13:50:00Z");

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "apply" : "dry-run",
        discussionPostsToDelete: (posts ?? []).length,
        professorRecsToUpsert: data.professor_recommendations.length,
        deletePreviews: (posts ?? []).map((p) => ({
          id: p.id,
          content: String(p.content).slice(0, 40),
        })),
        recPreviews: data.professor_recommendations.map((r) => ({
          course: r.course_code,
          professor: r.professor_name,
          content: r.content.slice(0, 50),
        })),
      },
      null,
      2
    )
  );

  if (!APPLY) {
    console.log("预览完成。加 --apply 会：删除误入评论 + 导入/更新教授评价");
    return;
  }

  if ((posts ?? []).length > 0) {
    const { error } = await supabase
      .from("discussion_posts")
      .delete()
      .in(
        "id",
        (posts ?? []).map((p) => p.id)
      );
    if (error) throw error;
    console.log(`已删除评论 ${posts!.length} 条`);
  }

  // 复用 import 逻辑：先删同批教授评价再插入，避免旧内容混乱
  const { data: existingRecs } = await supabase
    .from("professor_recommendations")
    .select("id, course_id, professor_name")
    .eq("user_id", AUTHOR_USER_ID)
    .in("course_id", courseIds)
    .gte("created_at", "2026-08-04T13:50:00Z");

  if ((existingRecs ?? []).length > 0) {
    const { error } = await supabase
      .from("professor_recommendations")
      .delete()
      .in(
        "id",
        (existingRecs ?? []).map((r) => r.id)
      );
    if (error) throw error;
    console.log(`已清理旧教授评价 ${existingRecs!.length} 条`);
  }

  const rows = data.professor_recommendations
    .map((r) => {
      const course_id = idByCode.get(r.course_code);
      if (!course_id) return null;
      return {
        course_id,
        user_id: AUTHOR_USER_ID,
        professor_name: r.professor_name,
        content: r.content,
      };
    })
    .filter(Boolean);

  if (rows.length) {
    const { error } = await supabase
      .from("professor_recommendations")
      .insert(rows);
    if (error) throw error;
  }

  console.log(`已写入教授评价 ${rows.length} 条`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
