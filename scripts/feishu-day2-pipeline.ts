/**
 * Day2 飞书抽样重导入流水线
 *
 * - API 抓取（含课程推荐评分 1–5）
 * - 仅保留网站课程目录中的代码
 * - 基础课（被多门课当作先修）加权后约 20% 抽样
 * - 清洗：隐私 / 人身攻击 / 全负面
 * - 分流：有教授 → professor_recommendations（逐条独立写入，不拼接）；无教授 → discussion_posts
 * - 评分：按文本语义生成综合/难度/给分；按飞书活跃度生成多份离散评分与求评价权重
 *
 * 用法：
 *   # 从目录全量 API 抓取 + 抽样清洗（不入库）
 *   npx tsx scripts/feishu-day2-pipeline.ts --scrape --catalog-all --seed 42
 *
 *   # 从 checkpoint / raw 继续
 *   npx tsx scripts/feishu-day2-pipeline.ts --from data/feishu-scrapes/feishu-api-checkpoint.json --seed 42
 *
 *   # 正式库干跑 / 写入
 *   npx tsx scripts/feishu-day2-pipeline.ts --from data/feishu-scrapes/sample-ready-day2-....json --import-prod
 *   npx tsx scripts/feishu-day2-pipeline.ts --from ... --import-prod --apply --confirm-prod --replace
 */
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { cleanReviewText } from "./lib/feishu-clean";
import {
  loadFoundationWeights,
  weightedSample,
} from "./lib/foundation-weights";
import {
  scrapeFeishuViaApi,
  type FeishuApiReview,
} from "./lib/feishu-api-scrape";
import {
  activityWeights,
  simulateScoresFromText,
} from "./lib/feishu-score-sim";
import { suggestOverallFromDimensions } from "../lib/reviews";
import {
  createTargetAdminClient,
  type AdminTarget,
} from "./lib/supabase-dev";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local.development") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const OUT_DIR = path.resolve(process.cwd(), "data", "feishu-scrapes");
const IMPORT_SOURCE = "feishu_sample";
const AUTHOR_USER_ID = "20feb4f8-023f-43db-8ae1-d31cba672dbc";
const COURSE_CODE_MAP: Record<string, string> = {
  GFN: "GFN1000",
  CEC2001: "GEA2000",
  "1002B": "MAT1002",
};

type PreparedText = {
  course_code: string;
  professor_name: string | null;
  content: string;
  recommend_score: number | null;
  course_type: string;
  kind: "professor" | "discussion";
};

type PreparedScore = {
  course_code: string;
  rating: number;
  difficulty: number;
  grading: number;
};

type PreparedBundle = {
  texts: PreparedText[];
  /** @deprecated 兼容旧 sample-ready；优先用 scores */
  ratings?: Array<{ course_code: string; rating: number; sample_size: number }>;
  scores: PreparedScore[];
  activity: Record<string, number>;
  stats: Record<string, unknown>;
};

function parseArgs(argv: string[]) {
  const flag = (n: string) => argv.includes(n);
  const value = (n: string) => {
    const i = argv.indexOf(n);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const samplePercent = Number(value("--sample-percent") ?? "20");
  const foundationThreshold = Number(value("--foundation-threshold") ?? "8");
  const foundationWeight = Number(value("--foundation-weight") ?? "3");
  const catalogSample = value("--catalog-sample");
  const seed = value("--seed");
  const from = value("--from");

  const codes = argv.filter(
    (a, idx) =>
      !a.startsWith("--") &&
      ![
        "--from",
        "--sample-percent",
        "--foundation-threshold",
        "--foundation-weight",
        "--catalog-sample",
        "--seed",
      ].includes(argv[idx - 1] ?? "")
  );

  return {
    scrape: flag("--scrape") || flag("--catalog-all") || Boolean(catalogSample) || codes.length > 0,
    catalogAll: flag("--catalog-all"),
    catalogSample: catalogSample ? Number(catalogSample) : null,
    headed: flag("--headed"),
    from,
    importProd: flag("--import-prod"),
    importDev: flag("--import-dev"),
    apply: flag("--apply"),
    confirmProd: flag("--confirm-prod"),
    confirmDev: flag("--confirm-dev"),
    replace: flag("--replace"),
    samplePercent: Number.isFinite(samplePercent) ? samplePercent : 20,
    foundationThreshold: Number.isFinite(foundationThreshold)
      ? foundationThreshold
      : 8,
    foundationWeight: Number.isFinite(foundationWeight) ? foundationWeight : 3,
    seed: seed ? Number(seed) : null,
    codes,
  };
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function resolveCode(raw: string) {
  const code = raw.trim().replace(/\s+/g, "").toUpperCase();
  return COURSE_CODE_MAP[code] ?? code;
}

function extractCourseCode(courseName: string, fallback: string) {
  const joined = `${courseName} ${fallback}`.toUpperCase();
  const m = joined.match(/[A-Z]{2,4}\s?\d{3,4}[A-Z]?/);
  return resolveCode(m?.[0] ?? fallback ?? courseName);
}

function hasProfessor(name?: string | null) {
  const n = (name ?? "").trim();
  if (!n || n === "-" || n === "无" || n === "未知") return false;
  if (n.length < 2 || n.length > 40) return false;
  if (/院系|查询|条查询|授课老师/.test(n)) return false;
  return true;
}

async function loadCatalogCodes(n: number | null) {
  const raw = JSON.parse(
    await readFile(path.resolve(process.cwd(), "data/courses.json"), "utf8")
  ) as Array<{ code: string }>;
  const codes = raw.map((c) => resolveCode(c.code)).filter(Boolean).sort();
  if (n == null) return codes;
  return codes.slice(0, Math.min(n, codes.length));
}

async function loadCatalogSet() {
  return new Set(await loadCatalogCodes(null));
}

function prepareBundle(
  reviews: FeishuApiReview[],
  opts: {
    percent: number;
    rng: () => number;
    foundation: Awaited<ReturnType<typeof loadFoundationWeights>>;
  }
): PreparedBundle {
  const catalog = new Set(opts.foundation.byCode.keys());
  const inCatalog: FeishuApiReview[] = [];
  let droppedNotInCatalog = 0;
  for (const row of reviews) {
    const code = extractCourseCode(row.course_name, row.source_query);
    if (!catalog.has(code)) {
      droppedNotInCatalog += 1;
      continue;
    }
    inCatalog.push({ ...row, course_name: code });
  }

  const activity: Record<string, number> = {};
  for (const row of inCatalog) {
    activity[row.course_name] = (activity[row.course_name] ?? 0) + 1;
  }

  const sampled = weightedSample(
    inCatalog,
    (row) => opts.foundation.byCode.get(row.course_name)?.weight ?? 1,
    opts.percent,
    opts.rng
  );

  const texts: PreparedText[] = [];
  const discarded: Record<string, number> = {};
  let foundationInSample = 0;

  for (const row of sampled) {
    if (opts.foundation.byCode.get(row.course_name)?.is_foundation) {
      foundationInSample += 1;
    }
    const cleaned = cleanReviewText(row.review, { courseType: row.course_type });
    if (!cleaned.ok) {
      for (const reason of cleaned.reasons) {
        discarded[reason] = (discarded[reason] ?? 0) + 1;
      }
      continue;
    }

    const prof = hasProfessor(row.professor) ? row.professor.trim() : null;
    texts.push({
      course_code: row.course_name,
      professor_name: prof,
      content: cleaned.text,
      recommend_score: row.recommend_score,
      course_type: row.course_type,
      kind: prof ? "professor" : "discussion",
    });
  }

  // 按课活跃度生成多份离散三维分（语义 + 飞书推荐分锚点）
  const byCourse = new Map<string, PreparedText[]>();
  for (const row of texts) {
    const list = byCourse.get(row.course_code) ?? [];
    list.push(row);
    byCourse.set(row.course_code, list);
  }

  const scores: PreparedScore[] = [];
  for (const [course_code, rows] of Array.from(byCourse.entries())) {
    const { scoreCopies } = activityWeights(activity[course_code] ?? rows.length);
    for (let i = 0; i < scoreCopies; i += 1) {
      const src = rows[i % rows.length];
      const simulated = simulateScoresFromText(
        src.content,
        src.recommend_score,
        opts.rng()
      );
      scores.push({ course_code, ...simulated });
    }
  }

  return {
    texts,
    scores,
    activity,
    ratings: [],
    stats: {
      scraped_raw: reviews.length,
      in_catalog: inCatalog.length,
      dropped_not_in_catalog: droppedNotInCatalog,
      sampled: sampled.length,
      foundation_in_sample: foundationInSample,
      foundation_threshold: opts.foundation.threshold,
      foundation_count: opts.foundation.foundationCodes.length,
      kept_texts: texts.length,
      professor_texts: texts.filter((t) => t.kind === "professor").length,
      discussion_texts: texts.filter((t) => t.kind === "discussion").length,
      score_rows: scores.length,
      rating_courses: byCourse.size,
      discarded,
      top_foundation: opts.foundation.foundationCodes.slice(0, 15),
    },
  };
}

function normalizeBundle(data: PreparedBundle & { ratings?: PreparedBundle["ratings"] }): PreparedBundle {
  const activity = data.activity ?? {};
  const byCourse = new Map<string, PreparedText[]>();
  for (const row of data.texts ?? []) {
    const list = byCourse.get(row.course_code) ?? [];
    list.push(row);
    byCourse.set(row.course_code, list);
  }
  // 始终按当前语义模型重算三维分（综合依赖难度/给分，ρ≈0.35）
  const scores: PreparedScore[] = [];
  for (const [course_code, rows] of Array.from(byCourse.entries())) {
    const count = activity[course_code] ?? rows.length;
    const { scoreCopies } = activityWeights(count);
    for (let i = 0; i < scoreCopies; i += 1) {
      const src = rows[i % rows.length];
      scores.push({
        course_code,
        ...simulateScoresFromText(
          src.content,
          src.recommend_score,
          (i + 1) / (scoreCopies + 1)
        ),
      });
    }
  }
  if (!scores.length && data.ratings?.length) {
    for (const r of data.ratings) {
      const difficulty = 3;
      const grading = r.rating;
      scores.push({
        course_code: r.course_code,
        rating:
          suggestOverallFromDimensions(difficulty, grading, 0.5) ?? r.rating,
        difficulty,
        grading,
      });
    }
  }
  return { ...data, scores, activity };
}

async function splitMergedProfessorRows(
  client: ReturnType<typeof createTargetAdminClient>["client"]
) {
  const { data: rows, error } = await client
    .from("professor_recommendations")
    .select("id, course_id, user_id, professor_name, content, status")
    .eq("user_id", AUTHOR_USER_ID)
    .ilike("content", "%——%");
  if (error) throw error;
  if (!rows?.length) return 0;

  let splitCount = 0;
  for (const row of rows) {
    const pieces = String(row.content)
      .split(/\n*\s*——\s*\n*/g)
      .map((p) => p.trim())
      .filter((p) => p.length >= 1);
    if (pieces.length <= 1) continue;

    const { error: delErr } = await client
      .from("professor_recommendations")
      .delete()
      .eq("id", row.id);
    if (delErr) throw delErr;

    const inserts = pieces.map((content) => ({
      course_id: row.course_id,
      user_id: row.user_id,
      professor_name: row.professor_name,
      content: content.slice(0, 2000),
      status: row.status ?? "visible",
      is_imported: false,
      source: null,
    }));
    const { error: insErr } = await client
      .from("professor_recommendations")
      .insert(inserts);
    if (insErr) throw insErr;
    splitCount += pieces.length;
  }
  return splitCount;
}

async function importBundle(
  bundle: PreparedBundle,
  target: AdminTarget,
  apply: boolean,
  confirmed: boolean,
  replace: boolean
) {
  if (apply && !confirmed) {
    throw new Error(
      target === "prod"
        ? "写入正式库需要 --apply --confirm-prod"
        : "写入 DEV 需要 --apply --confirm-dev"
    );
  }

  const prepared = normalizeBundle(bundle);
  const { client, host, urlKey } = createTargetAdminClient(target);
  console.log(`${target} → ${host}（${urlKey}）`);

  // phase10 / 10b / 11 探测
  const probeRec = await client
    .from("professor_recommendations")
    .select("id, is_imported, source")
    .limit(1);
  const probePost = await client
    .from("discussion_posts")
    .select("id, is_imported, source")
    .limit(1);
  const probeReview = await client
    .from("reviews")
    .select("id, is_imported, source")
    .limit(1);
  const probeReq = await client
    .from("review_requests")
    .select("id, is_imported, source")
    .limit(1);

  if (probeRec.error || probePost.error) {
    throw new Error(
      `缺少 professor_recommendations/discussion_posts 的 is_imported/source，请执行 phase10-import-source.sql\n${probeRec.error?.message ?? ""} ${probePost.error?.message ?? ""}`
    );
  }
  if (probeReview.error) {
    throw new Error(
      `缺少 reviews.is_imported/source，请执行 phase10b-reviews-import-source.sql\n${probeReview.error.message}`
    );
  }
  if (probeReq.error) {
    throw new Error(
      `缺少 review_requests.is_imported/source，请执行 phase11-multi-rec-and-import-scores.sql\n${probeReq.error.message}`
    );
  }

  if (apply && replace) {
    console.log("拆分历史拼接的教授评价 …");
    const split = await splitMergedProfessorRows(client);
    if (split) console.log(`已拆分还原 ${split} 段正文`);

    console.log("清理旧 feishu_sample …");
    await client
      .from("professor_recommendations")
      .delete()
      .eq("is_imported", true)
      .eq("source", IMPORT_SOURCE);
    await client
      .from("discussion_posts")
      .delete()
      .eq("is_imported", true)
      .eq("source", IMPORT_SOURCE);
    await client
      .from("reviews")
      .delete()
      .eq("is_imported", true)
      .eq("source", IMPORT_SOURCE);
    await client
      .from("review_requests")
      .delete()
      .eq("is_imported", true)
      .eq("source", IMPORT_SOURCE);
  }

  const needed = Array.from(
    new Set([
      ...prepared.texts.map((t) => t.course_code),
      ...prepared.scores.map((r) => r.course_code),
      ...Object.keys(prepared.activity ?? {}),
    ])
  );
  const { data: courses, error: courseError } = await client
    .from("courses")
    .select("id, code")
    .in("code", needed);
  if (courseError) throw courseError;
  const idByCode = new Map(
    (courses ?? []).map((c) => [c.code as string, c.id as string])
  );

  const profInsert: Array<Record<string, unknown>> = [];
  const discInsert: Array<Record<string, unknown>> = [];
  const reviewInsert: Array<Record<string, unknown>> = [];
  const requestInsert: Array<Record<string, unknown>> = [];

  const { data: existingProf } = await client
    .from("professor_recommendations")
    .select("course_id, professor_name, content")
    .eq("user_id", AUTHOR_USER_ID);
  const profContentKeys = new Set(
    (existingProf ?? []).map(
      (r) =>
        `${r.course_id}::${String(r.professor_name).trim().toLowerCase()}::${String(r.content).trim()}`
    )
  );

  const { data: existingDisc } = await client
    .from("discussion_posts")
    .select("course_id, content")
    .eq("user_id", AUTHOR_USER_ID);
  const discKeys = new Set(
    (existingDisc ?? []).map(
      (r) => `${r.course_id}::${String(r.content).trim()}`
    )
  );

  // 逐条独立写入，绝不拼接 ——
  for (const row of prepared.texts) {
    const courseId = idByCode.get(row.course_code);
    if (!courseId) continue;
    const content = row.content.trim();
    if (!content) continue;

    if (row.kind === "professor" && row.professor_name) {
      const name = row.professor_name.trim().slice(0, 40);
      if (!name) continue;
      const key = `${courseId}::${name.toLowerCase()}::${content}`;
      if (profContentKeys.has(key)) continue;
      profContentKeys.add(key);
      profInsert.push({
        course_id: courseId,
        user_id: AUTHOR_USER_ID,
        professor_name: name,
        content: content.slice(0, 2000),
        is_imported: true,
        source: IMPORT_SOURCE,
      });
    } else {
      const key = `${courseId}::${content}`;
      if (discKeys.has(key)) continue;
      discKeys.add(key);
      discInsert.push({
        course_id: courseId,
        user_id: AUTHOR_USER_ID,
        parent_id: null,
        content: content.slice(0, 1000),
        tags: [],
        is_imported: true,
        source: IMPORT_SOURCE,
      });
    }
  }

  for (const row of prepared.scores) {
    const courseId = idByCode.get(row.course_code);
    if (!courseId) continue;
    reviewInsert.push({
      course_id: courseId,
      user_id: AUTHOR_USER_ID,
      rating: row.rating,
      difficulty: row.difficulty,
      grading: row.grading,
      content: "",
      tags: [],
      is_imported: true,
      source: IMPORT_SOURCE,
    });
  }

  // 求评价权重：按飞书全量活跃度
  const coursesForRequests = new Set([
    ...prepared.texts.map((t) => t.course_code),
    ...prepared.scores.map((s) => s.course_code),
  ]);
  for (const code of coursesForRequests) {
    const courseId = idByCode.get(code);
    if (!courseId) continue;
    const { requestCopies } = activityWeights(
      prepared.activity?.[code] ?? prepared.texts.filter((t) => t.course_code === code).length
    );
    for (let i = 0; i < requestCopies; i += 1) {
      requestInsert.push({
        course_id: courseId,
        user_id: AUTHOR_USER_ID,
        is_imported: true,
        source: IMPORT_SOURCE,
      });
    }
  }

  const summary = {
    mode: apply ? "APPLY" : "DRY-RUN",
    target,
    host,
    replace,
    willInsertProfessor: profInsert.length,
    willInsertDiscussion: discInsert.length,
    willInsertReviews: reviewInsert.length,
    willInsertRequests: requestInsert.length,
    missingCourses: needed.filter((c) => !idByCode.has(c)).slice(0, 20),
    previews: {
      professor: profInsert.slice(0, 3),
      discussion: discInsert.slice(0, 3),
      reviews: reviewInsert.slice(0, 5),
    },
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!apply) {
    console.log("干跑完成。确认后加 --apply --confirm-prod [--replace]");
    return summary;
  }

  // 分批插入，避免 payload 过大
  async function insertChunks(
    table: string,
    rows: Array<Record<string, unknown>>,
    size = 100
  ) {
    for (let i = 0; i < rows.length; i += size) {
      const chunk = rows.slice(i, i + size);
      const { error } = await client.from(table).insert(chunk);
      if (error) throw error;
    }
  }

  if (profInsert.length) await insertChunks("professor_recommendations", profInsert);
  if (discInsert.length) await insertChunks("discussion_posts", discInsert);
  if (reviewInsert.length) await insertChunks("reviews", reviewInsert);
  if (requestInsert.length) await insertChunks("review_requests", requestInsert);

  console.log(
    `已写入：教授评价 ${profInsert.length}，讨论 ${discInsert.length}，评分 ${reviewInsert.length}，求评价权重 ${requestInsert.length}`
  );
  return summary;
}

function resolveTarget(args: {
  importProd: boolean;
  importDev: boolean;
}): AdminTarget | null {
  if (args.importProd && args.importDev) {
    throw new Error("不能同时 --import-prod 与 --import-dev");
  }
  if (args.importProd) return "prod";
  if (args.importDev) return "dev";
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(OUT_DIR, { recursive: true });
  const rng =
    args.seed != null && Number.isFinite(args.seed)
      ? mulberry32(args.seed)
      : Math.random;

  // sample-ready-day2 直接导入
  if (args.from && /sample-ready-day2-/.test(args.from)) {
    const file = path.resolve(process.cwd(), args.from);
    const data = JSON.parse(await readFile(file, "utf8")) as PreparedBundle & {
      stats?: unknown;
    };
    console.log(`加载 ${file}`);
    console.log("stats", data.stats);
    const target = resolveTarget(args);
    if (!target) {
      console.log(
        [
          "导入正式库：",
          `  npx tsx scripts/feishu-day2-pipeline.ts --from ${path.relative(process.cwd(), file).replace(/\\/g, "/")} --import-prod`,
          `  npx tsx scripts/feishu-day2-pipeline.ts --from ${path.relative(process.cwd(), file).replace(/\\/g, "/")} --import-prod --apply --confirm-prod --replace`,
        ].join("\n")
      );
      return;
    }
    await importBundle(
      {
        texts: data.texts,
        ratings: data.ratings,
        scores: data.scores ?? [],
        activity: data.activity ?? {},
        stats: data.stats ?? {},
      },
      target,
      args.apply,
      target === "prod" ? args.confirmProd : args.confirmDev,
      args.replace
    );
    return;
  }

  let reviews: FeishuApiReview[] = [];
  let sourceFile: string | null = null;

  if (args.from) {
    sourceFile = path.resolve(process.cwd(), args.from);
    const data = JSON.parse(await readFile(sourceFile, "utf8"));
    reviews = (data.reviews ?? []) as FeishuApiReview[];
    console.log(`从文件加载 ${reviews.length} 条：${sourceFile}`);
  } else if (args.scrape) {
    let codes = args.codes;
    if (args.catalogAll) codes = await loadCatalogCodes(null);
    else if (args.catalogSample != null) {
      codes = await loadCatalogCodes(args.catalogSample);
    }
    if (!codes.length) {
      throw new Error("请提供课程代码，或 --catalog-all / --catalog-sample N");
    }
    console.log(`将 API 抓取 ${codes.length} 门课（含推荐评分）`);

    const checkpointPath = path.join(OUT_DIR, "feishu-api-checkpoint.json");
    let prior: FeishuApiReview[] = [];
    let alreadyDone = new Set<string>();
    try {
      const cp = JSON.parse(await readFile(checkpointPath, "utf8")) as {
        done_codes?: string[];
        reviews?: FeishuApiReview[];
      };
      prior = cp.reviews ?? [];
      alreadyDone = new Set(cp.done_codes ?? []);
      if (alreadyDone.size) {
        console.log(
          `断点续跑：已完成 ${alreadyDone.size} 门、${prior.length} 条`
        );
      }
    } catch {
      // no checkpoint
    }

    const { reviews: fresh } = await scrapeFeishuViaApi(codes, {
      headed: args.headed,
      alreadyDone,
      onBatch: async (all, doneCodes) => {
        const mergedMap = new Map<string, FeishuApiReview>();
        for (const r of [...prior, ...all]) {
          mergedMap.set(r.record_id || `${r.course_name}::${r.professor}::${r.review}`, r);
        }
        const merged = Array.from(mergedMap.values());
        await writeFile(
          checkpointPath,
          `${JSON.stringify(
            {
              updated_at: new Date().toISOString(),
              done_codes: Array.from(
                new Set([...alreadyDone, ...doneCodes])
              ).sort(),
              count: merged.length,
              with_score: merged.filter((r) => r.recommend_score != null).length,
              reviews: merged,
            },
            null,
            2
          )}\n`
        );
        console.log(
          `checkpoint：${merged.length} 条（含评分 ${merged.filter((r) => r.recommend_score != null).length}）`
        );
      },
    });

    const mergedMap = new Map<string, FeishuApiReview>();
    for (const r of [...prior, ...fresh]) {
      mergedMap.set(
        r.record_id || `${r.course_name}::${r.professor}::${r.review}`,
        r
      );
    }
    reviews = Array.from(mergedMap.values());
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    sourceFile = path.join(OUT_DIR, `feishu-api-raw-${stamp}.json`);
    await writeFile(
      sourceFile,
      `${JSON.stringify(
        {
          scraped_at: new Date().toISOString(),
          count: reviews.length,
          with_score: reviews.filter((r) => r.recommend_score != null).length,
          reviews,
        },
        null,
        2
      )}\n`
    );
    console.log(`原始 API 抓取已保存：${sourceFile}（${reviews.length}）`);
  } else {
    // 优先 api checkpoint
    const candidates = [
      "feishu-api-checkpoint.json",
      ...(await readdir(OUT_DIR)).filter((f) => f.startsWith("feishu-api-raw-")),
    ].sort();
    const latest = candidates[candidates.length - 1];
    if (!latest) throw new Error("没有 API 抓取文件，请先 --scrape --catalog-all");
    sourceFile = path.join(OUT_DIR, latest);
    const data = JSON.parse(await readFile(sourceFile, "utf8"));
    reviews = (data.reviews ?? []) as FeishuApiReview[];
    console.log(`使用 ${sourceFile}（${reviews.length}）`);
  }

  if (!reviews.length) throw new Error("无评价数据");

  // 若是旧文本抓取（无数字评分），提示
  const withScore = reviews.filter((r) => r.recommend_score != null).length;
  if (withScore === 0) {
    console.warn(
      "警告：当前数据没有任何 recommend_score。请用 --scrape --catalog-all 走 API 重抓。"
    );
  }

  const foundation = await loadFoundationWeights({
    threshold: args.foundationThreshold,
    foundationWeight: args.foundationWeight,
    normalWeight: 1,
  });
  console.log(
    `基础课（先修被引 ≥ ${foundation.threshold}）：${foundation.foundationCodes.length} 门，权重 ${args.foundationWeight}×`
  );

  const catalog = await loadCatalogSet();
  // 过滤 junk
  reviews = reviews.filter((r) => {
    const code = extractCourseCode(r.course_name, r.source_query);
    if (!catalog.has(code)) return false;
    if (/授课老师|条查询|院系/.test(r.course_name)) return false;
    return true;
  });

  const bundle = prepareBundle(reviews, {
    percent: args.samplePercent,
    rng,
    foundation,
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const readyPath = path.join(OUT_DIR, `sample-ready-day2-${stamp}.json`);
  const payload = {
    prepared_at: new Date().toISOString(),
    source_file: sourceFile,
    sample_percent: args.samplePercent,
    seed: args.seed,
    policy: {
      score_field: "文本语义 + 飞书推荐分 → reviews.(rating,difficulty,grading)",
      foundation_weight: args.foundationWeight,
      foundation_threshold: args.foundationThreshold,
      professor_or_discussion: true,
      no_dash_merge: true,
      activity_weighted_scores: true,
      source: IMPORT_SOURCE,
    },
    stats: bundle.stats,
    texts: bundle.texts,
    scores: bundle.scores,
    activity: bundle.activity,
    ratings: bundle.ratings,
  };
  await writeFile(readyPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(bundle.stats, null, 2));
  console.log(`已写出：${readyPath}`);

  const target = resolveTarget(args);
  if (!target) {
    const rel = path.relative(process.cwd(), readyPath).replace(/\\/g, "/");
    console.log(
      [
        "",
        "下一步：先在正式库执行 supabase/phase11-multi-rec-and-import-scores.sql",
        `  npx tsx scripts/feishu-day2-pipeline.ts --from ${rel} --import-prod`,
        `  npx tsx scripts/feishu-day2-pipeline.ts --from ${rel} --import-prod --apply --confirm-prod --replace`,
      ].join("\n")
    );
    return;
  }

  await importBundle(
    bundle,
    target,
    args.apply,
    target === "prod" ? args.confirmProd : args.confirmDev,
    args.replace
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
