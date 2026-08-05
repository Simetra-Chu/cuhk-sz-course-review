/**
 * 清理已导入内容中的 【考核形式】【朋友圈】 与 [nylon:…] 标记
 *
 *   npx tsx scripts/clean-nylon-decorations.ts
 *   npx tsx scripts/clean-nylon-decorations.ts --apply
 */
import path from "node:path";
import dotenv from "dotenv";
import { createAdminClient } from "../lib/supabase/admin";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const APPLY = process.argv.includes("--apply");
const AUTHOR_USER_ID = "20feb4f8-023f-43db-8ae1-d31cba672dbc";

function stripImportDecorations(content: string) {
  return content
    .replace(/【考核形式】/g, "")
    .replace(/【朋友圈】/g, "")
    .replace(/\n*\s*\[nylon:[^\]]+\]\s*/g, "")
    .trim();
}

async function main() {
  const supabase = createAdminClient();

  const { data: posts, error: postsError } = await supabase
    .from("discussion_posts")
    .select("id, content")
    .eq("user_id", AUTHOR_USER_ID);

  if (postsError) throw postsError;

  const { data: recs, error: recsError } = await supabase
    .from("professor_recommendations")
    .select("id, content")
    .eq("user_id", AUTHOR_USER_ID);

  if (recsError) throw recsError;

  const postUpdates = (posts ?? [])
    .map((row) => {
      const next = stripImportDecorations(String(row.content));
      return next !== row.content
        ? { id: row.id as string, content: next }
        : null;
    })
    .filter(Boolean) as Array<{ id: string; content: string }>;

  const recUpdates = (recs ?? [])
    .map((row) => {
      const next = stripImportDecorations(String(row.content));
      return next !== row.content
        ? { id: row.id as string, content: next }
        : null;
    })
    .filter(Boolean) as Array<{ id: string; content: string }>;

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "apply" : "dry-run",
        postsToUpdate: postUpdates.length,
        recsToUpdate: recUpdates.length,
        samples: {
          posts: postUpdates.slice(0, 3),
          recs: recUpdates.slice(0, 2),
        },
      },
      null,
      2
    )
  );

  if (!APPLY) {
    console.log("\n预览完成。加上 --apply 才会写入。");
    return;
  }

  for (const row of postUpdates) {
    const { error } = await supabase
      .from("discussion_posts")
      .update({ content: row.content })
      .eq("id", row.id);
    if (error) throw error;
  }

  for (const row of recUpdates) {
    const { error } = await supabase
      .from("professor_recommendations")
      .update({ content: row.content })
      .eq("id", row.id);
    if (error) throw error;
  }

  console.log(
    `已清理评论 ${postUpdates.length} 条、教授推荐 ${recUpdates.length} 条`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
