/**
 * 将尼龙朋友圈 Excel 评价导入到当前用户账号下。
 *
 * - 评价 / 考核形式 → discussion_posts（评论区）
 * - 教授评价 → professor_recommendations（同课同教授多条会合并）
 *
 * 用法：
 *   npx tsx scripts/import-nylon-moments.ts          # 预览
 *   npx tsx scripts/import-nylon-moments.ts --apply   # 写入
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { createAdminClient } from "../lib/supabase/admin";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const APPLY = process.argv.includes("--apply");

/** 导入挂到该用户（125020443@link.cuhk.edu.cn） */
const AUTHOR_USER_ID = "20feb4f8-023f-43db-8ae1-d31cba672dbc";
const AUTHOR_EMAIL = "125020443@link.cuhk.edu.cn";

const COURSE_CODE_MAP: Record<string, string> = {
  把杆训练: "PED1102",
  定向越野: "PED1109",
  太极: "PED1118",
  武术散打: "PED1122",
  瑜伽课: "PED1123",
  GFN: "GFN1000",
  // Excel 的 CEC2001 不在教务目录；赵瑞娟方向近现代史 → 现有 GEA2000
  CEC2001: "GEA2000",
};

type ExcelRow = {
  序号: string;
  来源: string;
  类型: string;
  课程代码: string;
  教授: string;
  评价: string;
};

type DumpFile = {
  Sheet1: { rows: ExcelRow[] };
};

function resolveCourseCode(raw: string) {
  const trimmed = raw.trim();
  return COURSE_CODE_MAP[trimmed] ?? trimmed.toUpperCase();
}

function hasProfessor(name: string) {
  const n = name.trim();
  return n.length > 0 && n !== "无";
}

function buildCommentContent(row: ExcelRow) {
  const parts: string[] = [];
  if (row.类型 === "考核形式") {
    parts.push("【考核形式】");
  } else {
    parts.push("【朋友圈】");
  }
  if (hasProfessor(row.教授)) {
    parts.push(`${row.教授.trim()}：`);
  }
  parts.push(row.评价.trim());
  const text = parts.join("").trim();
  // 幂等标记，便于重复导入时跳过
  return `${text}\n\n[nylon:${row.序号}]`;
}

function buildProfessorContent(rows: ExcelRow[]) {
  const body = rows
    .map((row) => row.评价.trim())
    .filter(Boolean)
    .join("\n\n——\n\n");
  const ids = rows.map((row) => row.序号).join(",");
  return `${body}\n\n[nylon:${ids}]`;
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL（.env.local）");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("缺少 SUPABASE_SERVICE_ROLE_KEY（.env.local）");
  }

  const dumpPath = path.resolve(process.cwd(), "_excel_dump.json");
  const dump = JSON.parse(await readFile(dumpPath, "utf8")) as DumpFile;
  const rows = dump.Sheet1.rows;

  const supabase = createAdminClient();

  // 校验用户存在
  const { data: userData, error: userError } =
    await supabase.auth.admin.getUserById(AUTHOR_USER_ID);
  if (userError || !userData.user) {
    throw new Error(
      `找不到用户 ${AUTHOR_USER_ID}：${userError?.message ?? "unknown"}`
    );
  }
  if (
    userData.user.email &&
    userData.user.email.toLowerCase() !== AUTHOR_EMAIL.toLowerCase()
  ) {
    throw new Error(
      `用户邮箱不匹配：期望 ${AUTHOR_EMAIL}，实际 ${userData.user.email}`
    );
  }

  const neededCodes = Array.from(
    new Set(rows.map((row) => resolveCourseCode(row.课程代码)))
  );

  const { data: courses, error: courseError } = await supabase
    .from("courses")
    .select("id, code")
    .in("code", neededCodes);

  if (courseError) throw courseError;

  const courseIdByCode = new Map(
    (courses ?? []).map((c) => [c.code as string, c.id as string])
  );
  const missing = neededCodes.filter((code) => !courseIdByCode.has(code));
  if (missing.length > 0) {
    throw new Error(`课程不存在，请先导入课程：${missing.join(", ")}`);
  }

  const commentRows = rows.filter(
    (row) => row.类型 === "评价" || row.类型 === "考核形式"
  );
  const professorRows = rows.filter((row) => row.类型 === "教授评价");

  // 同课同教授合并
  const professorGroups = new Map<string, ExcelRow[]>();
  for (const row of professorRows) {
    if (!hasProfessor(row.教授)) {
      console.warn(`跳过无教授名的教授评价 序号=${row.序号}`);
      continue;
    }
    if (row.教授.trim().length < 2) {
      console.warn(`教授名过短，跳过 序号=${row.序号} 教授=${row.教授}`);
      continue;
    }
    const code = resolveCourseCode(row.课程代码);
    const key = `${code}::${row.教授.trim().toLowerCase()}`;
    const list = professorGroups.get(key) ?? [];
    list.push(row);
    professorGroups.set(key, list);
  }

  // 已有 nylon 标记，避免重复
  const { data: existingPosts } = await supabase
    .from("discussion_posts")
    .select("id, content")
    .eq("user_id", AUTHOR_USER_ID)
    .ilike("content", "%[nylon:%");

  const existingNylonIds = new Set<string>();
  for (const post of existingPosts ?? []) {
    const matches = String(post.content).matchAll(/\[nylon:([^\]]+)\]/g);
    for (const m of matches) {
      for (const id of m[1].split(",")) existingNylonIds.add(id.trim());
    }
  }

  const { data: existingRecs } = await supabase
    .from("professor_recommendations")
    .select("id, content, professor_name, course_id")
    .eq("user_id", AUTHOR_USER_ID)
    .ilike("content", "%[nylon:%");

  for (const rec of existingRecs ?? []) {
    const matches = String(rec.content).matchAll(/\[nylon:([^\]]+)\]/g);
    for (const m of matches) {
      for (const id of m[1].split(",")) existingNylonIds.add(id.trim());
    }
  }

  const commentsToInsert: Array<{
    course_id: string;
    user_id: string;
    parent_id: null;
    content: string;
  }> = [];

  for (const row of commentRows) {
    if (existingNylonIds.has(row.序号)) {
      console.log(`跳过已导入评论 序号=${row.序号}`);
      continue;
    }
    const code = resolveCourseCode(row.课程代码);
    const content = buildCommentContent(row);
    if (content.length > 1000) {
      throw new Error(`评论过长 序号=${row.序号} len=${content.length}`);
    }
    commentsToInsert.push({
      course_id: courseIdByCode.get(code)!,
      user_id: AUTHOR_USER_ID,
      parent_id: null,
      content,
    });
  }

  const recsToInsert: Array<{
    course_id: string;
    user_id: string;
    professor_name: string;
    content: string;
  }> = [];
  const recsToUpdate: Array<{ id: string; content: string }> = [];

  for (const [, group] of Array.from(professorGroups.entries())) {
    const fresh = group.filter((row) => !existingNylonIds.has(row.序号));
    if (fresh.length === 0) {
      console.log(
        `跳过已导入教授评价 序号=${group.map((r) => r.序号).join(",")}`
      );
      continue;
    }

    const code = resolveCourseCode(group[0].课程代码);
    const courseId = courseIdByCode.get(code)!;
    const professorName = group[0].教授.trim();
    const content = buildProfessorContent(fresh);

    const existing = (existingRecs ?? []).find(
      (rec) =>
        rec.course_id === courseId &&
        String(rec.professor_name).trim().toLowerCase() ===
          professorName.toLowerCase()
    );

    if (existing) {
      // 已有同教授推荐：追加内容
      recsToUpdate.push({
        id: existing.id as string,
        content: `${String(existing.content).trim()}\n\n——\n\n${content}`,
      });
    } else {
      recsToInsert.push({
        course_id: courseId,
        user_id: AUTHOR_USER_ID,
        professor_name: professorName,
        content,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "apply" : "dry-run",
        author: { id: AUTHOR_USER_ID, email: AUTHOR_EMAIL },
        totals: {
          excelRows: rows.length,
          commentsToInsert: commentsToInsert.length,
          professorRecsToInsert: recsToInsert.length,
          professorRecsToUpdate: recsToUpdate.length,
        },
        courseMap: Object.fromEntries(
          neededCodes.map((code) => [
            code,
            courseIdByCode.get(code) ? "ok" : "MISSING",
          ])
        ),
        sampleComments: commentsToInsert.slice(0, 3).map((c) => c.content),
        sampleRecs: recsToInsert.slice(0, 2),
      },
      null,
      2
    )
  );

  if (!APPLY) {
    console.log("\n预览完成。加上 --apply 才会写入数据库。");
    return;
  }

  if (commentsToInsert.length > 0) {
    const { error } = await supabase
      .from("discussion_posts")
      .insert(commentsToInsert);
    if (error) throw error;
    console.log(`已写入评论 ${commentsToInsert.length} 条`);
  }

  if (recsToInsert.length > 0) {
    const { error } = await supabase
      .from("professor_recommendations")
      .insert(recsToInsert);
    if (error) throw error;
    console.log(`已写入教授推荐 ${recsToInsert.length} 条`);
  }

  for (const rec of recsToUpdate) {
    const { error } = await supabase
      .from("professor_recommendations")
      .update({ content: rec.content })
      .eq("id", rec.id);
    if (error) throw error;
  }
  if (recsToUpdate.length > 0) {
    console.log(`已更新教授推荐 ${recsToUpdate.length} 条`);
  }

  console.log("导入完成。");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
