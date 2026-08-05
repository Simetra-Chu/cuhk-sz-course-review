/**
 * Strip leading 【...】 prefixes from professor_recommendations for a user.
 *   npx tsx scripts/strip-bracket-prefix-recs.ts
 */
import path from "node:path";
import dotenv from "dotenv";
import { createAdminClient } from "../lib/supabase/admin";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const USER_ID = "20feb4f8-023f-43db-8ae1-d31cba672dbc";
const PREFIX_RE = /^【[^】]*】/;

function preview(s: string, n = 80) {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? one.slice(0, n) + "…" : one;
}

async function main() {
  const supabase = createAdminClient();

  const { data: rows, error } = await supabase
    .from("professor_recommendations")
    .select("id, professor_name, content")
    .eq("user_id", USER_ID);

  if (error) throw error;

  const targets = (rows ?? []).filter(
    (r) => typeof r.content === "string" && PREFIX_RE.test(r.content)
  );

  console.log(`Matched ${targets.length} row(s) with leading 【...】\n`);

  let updated = 0;
  for (const row of targets) {
    const oldContent = row.content as string;
    const newContent = oldContent.replace(PREFIX_RE, "").trimStart();

    console.log("---");
    console.log(`id: ${row.id}`);
    console.log(`professor_name: ${row.professor_name}`);
    console.log(`old: ${preview(oldContent)}`);
    console.log(`new: ${preview(newContent)}`);

    const { error: updErr } = await supabase
      .from("professor_recommendations")
      .update({ content: newContent })
      .eq("id", row.id);

    if (updErr) throw updErr;
    updated++;
  }

  console.log(`\nUpdated count: ${updated}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
