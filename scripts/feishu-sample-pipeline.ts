/**
 * 飞书多维表格：一次性抽样导入流水线
 *
 * 流程：Scrape → 目录过滤 → Shuffle 20% → Clean → Dry-run / Import
 *
 * 用法：
 *   # 用网站全部课程代码，在飞书查询页逐个输入并抓取（推荐）
 *   npx tsx scripts/feishu-sample-pipeline.ts --scrape --catalog-all --seed 42
 *
 *   # 从课程目录随机抽 N 门课去飞书查询
 *   npx tsx scripts/feishu-sample-pipeline.ts --scrape --catalog-sample 40
 *
 *   # 指定课程代码
 *   npx tsx scripts/feishu-sample-pipeline.ts --scrape ENG1001 ACT2111
 *
 *   # 已有抓取 JSON，只做抽样+清洗
 *   npx tsx scripts/feishu-sample-pipeline.ts --from data/feishu-scrapes/xxx.json
 *
 *   # 2) 对正式库干跑（默认推荐；需 .env.local）
 *   npx tsx scripts/feishu-sample-pipeline.ts --from ... --import-prod
 *
 *   # 3) 真正写入正式库（需额外确认）
 *   npx tsx scripts/feishu-sample-pipeline.ts --from ... --import-prod --apply --confirm-prod
 *
 *   # （可选）DEV
 *   npx tsx scripts/feishu-sample-pipeline.ts --from ... --import-dev --apply --confirm-dev
 *
 * 可选：
 *   --sample-percent 20
 *   --headed
 *   --seed 42
 */
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { chromium, type Page } from "playwright";
import {
  cleanReviewText,
  samplePercent,
  shuffleInPlace,
} from "./lib/feishu-clean";
import {
  createTargetAdminClient,
  type AdminTarget,
} from "./lib/supabase-dev";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local.development") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.development.local") });
// 仅用于读取课程目录等非密钥配置；导入仍走 DEV client
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SHARE_URL =
  "https://blankspace.feishu.cn/share/base/query/shrcnbdLnH8R7q0OjN2bPLHnFMd";
const OUT_DIR = path.resolve(process.cwd(), "data", "feishu-scrapes");
const IMPORT_SOURCE = "feishu_sample";
const AUTHOR_USER_ID = "20feb4f8-023f-43db-8ae1-d31cba672dbc";

const COURSE_CODE_MAP: Record<string, string> = {
  GFN: "GFN1000",
  CEC2001: "GEA2000",
  "1002B": "MAT1002",
};

type FeishuReview = {
  course_name: string;
  professor: string;
  attendance: string;
  course_type: string;
  assessment: string[];
  review: string;
  recommend_score: string;
  source_query: string;
};

type PreparedRow = {
  course_code: string;
  professor_name: string;
  content: string;
  recommend_score: string;
  attendance: string;
  course_type: string;
  raw_review: string;
};

function parseArgs(argv: string[]) {
  const flag = (name: string) => argv.includes(name);
  const value = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  const samplePercentArg = Number(value("--sample-percent") ?? "20");
  const catalogSample = value("--catalog-sample");
  const seed = value("--seed");
  const from = value("--from");
  const catalogAll = flag("--catalog-all");

  const codes = argv.filter(
    (a, idx) =>
      !a.startsWith("--") &&
      argv[idx - 1] !== "--from" &&
      argv[idx - 1] !== "--sample-percent" &&
      argv[idx - 1] !== "--catalog-sample" &&
      argv[idx - 1] !== "--seed"
  );

  return {
    scrape:
      flag("--scrape") ||
      codes.length > 0 ||
      Boolean(catalogSample) ||
      catalogAll,
    headed: flag("--headed"),
    from,
    importDev: flag("--import-dev"),
    importProd: flag("--import-prod"),
    apply: flag("--apply"),
    confirmDev: flag("--confirm-dev"),
    confirmProd: flag("--confirm-prod"),
    samplePercent: Number.isFinite(samplePercentArg) ? samplePercentArg : 20,
    catalogSample: catalogSample ? Number(catalogSample) : null,
    catalogAll,
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

function extractCourseCode(courseName: string, fallbackQuery: string) {
  const joined = `${courseName} ${fallbackQuery}`.toUpperCase();
  const m = joined.match(/[A-Z]{2,4}\s?\d{3,4}[A-Z]?/);
  if (m) return resolveCode(m[0]);
  return resolveCode(fallbackQuery || courseName);
}

const SEARCH_BTN =
  'button:has-text("查询"), button:has-text("Search"), button:has-text("搜索")';
const INPUTS =
  'input[placeholder="请输入"], input[placeholder="Enter here"]';
const LOAD_MORE =
  'button:has-text("加载更多"), button:has-text("Load More")';

async function waitForQueryReady(page: Page) {
  await page.waitForSelector(SEARCH_BTN, { timeout: 60_000 });
  await page.waitForSelector(INPUTS, { timeout: 60_000 });
}

async function searchCourse(page: Page, courseCode: string) {
  const inputs = page.locator(INPUTS);
  await inputs.nth(0).fill("");
  if (courseCode) {
    await inputs.nth(0).fill(courseCode);
  }

  const count = await inputs.count();
  for (let i = 1; i < Math.min(count, 3); i += 1) {
    await inputs.nth(i).fill("");
  }

  await page.locator(SEARCH_BTN).first().click();

  await page.waitForTimeout(2000);
  await Promise.race([
    page.waitForFunction(
      () =>
        /results|条结果|Load More|加载更多|No results|暂无|没有|课程评价|课程名称/.test(
          document.body.innerText
        ),
      { timeout: 45_000 }
    ),
    page.waitForTimeout(5000),
  ]);
}

async function clickLoadMoreUntilDone(page: Page) {
  for (let i = 0; i < 100; i += 1) {
    const loadMore = page.locator(LOAD_MORE).first();
    if ((await loadMore.count()) === 0) break;
    if (!(await loadMore.isVisible().catch(() => false))) break;

    const before = await page.evaluate(() => document.body.innerText.length);
    await loadMore.click().catch(() => undefined);
    await page.waitForTimeout(1100);
    const after = await page.evaluate(() => document.body.innerText.length);
    if (after <= before + 20) {
      await page.waitForTimeout(700);
      if (!(await loadMore.isVisible().catch(() => false))) break;
    }
  }
}

function pickField(block: string, label: string, stopLabels: string[]) {
  const start = block.indexOf(`\n${label}\n`);
  const altStart = block.startsWith(`${label}\n`) ? 0 : -1;
  const idx =
    start >= 0
      ? start + label.length + 2
      : altStart === 0
        ? label.length + 1
        : -1;
  if (idx < 0) return "";

  let end = block.length;
  for (const stop of stopLabels) {
    for (const needle of [`\n${stop}\n`, `\n${stop}`]) {
      const p = block.indexOf(needle, idx);
      if (p >= 0) end = Math.min(end, p);
    }
  }
  return block.slice(idx, end).trim();
}

function clean(value: string) {
  return value
    .replace(/\u200b/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\n?课程推荐评分\s*$/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function parseReviewsFromText(text: string, sourceQuery: string): FeishuReview[] {
  const marker = text.match(/\d+\s+results|共\s*\d+\s*条/);
  const body = marker ? text.slice(text.indexOf(marker[0])) : text;
  const chunks = body.split(/\n课程名称\n/).slice(1);
  const reviews: FeishuReview[] = [];

  for (const chunk of chunks) {
    const block = `课程名称\n${chunk}`;
    const course_name = pickField(block, "课程名称", [
      "授课老师",
      "签到频率",
      "课程类型",
      "考核方式",
      "课程评价",
      "课程推荐评分",
    ]);
    const professor = pickField(block, "授课老师", [
      "签到频率",
      "课程类型",
      "考核方式",
      "课程评价",
      "课程推荐评分",
    ]);
    const attendance = pickField(block, "签到频率", [
      "课程类型",
      "考核方式",
      "课程评价",
      "课程推荐评分",
    ]);
    const course_type = pickField(block, "课程类型", [
      "考核方式",
      "课程评价",
      "课程推荐评分",
    ]);
    const assessmentRaw = pickField(block, "考核方式", [
      "课程评价",
      "课程推荐评分",
    ]);
    const review = pickField(block, "课程评价", ["课程推荐评分"]);
    const recommend_score = pickField(block, "课程推荐评分", []);

    if (!course_name && !review) continue;

    reviews.push({
      course_name: clean(course_name),
      professor: clean(professor),
      attendance: clean(attendance),
      course_type: clean(course_type),
      assessment: assessmentRaw
        .split(/\n+/)
        .map(clean)
        .filter((x) => x && x !== "+1" && !/^\+\d+$/.test(x)),
      review: clean(review),
      recommend_score: clean(recommend_score),
      source_query: sourceQuery,
    });
  }

  return reviews;
}

async function scrapeCodes(
  codes: string[],
  headed: boolean,
  opts?: {
    checkpointPath?: string;
    alreadyDone?: Set<string>;
    onBatch?: (all: FeishuReview[], doneCodes: string[]) => Promise<void>;
  }
) {
  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({
    locale: "zh-CN",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  const all: FeishuReview[] = [];
  const doneCodes: string[] = [];
  const skip = opts?.alreadyDone ?? new Set<string>();

  try {
    console.log(`打开查询页：${SHARE_URL}`);
    await page.goto(SHARE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await waitForQueryReady(page);

    for (let i = 0; i < codes.length; i += 1) {
      const code = codes[i];
      if (skip.has(code)) {
        console.log(`[${i + 1}/${codes.length}] 跳过已抓：${code}`);
        continue;
      }

      console.log(`\n[${i + 1}/${codes.length}] ==> 查询 ${code}`);
      try {
        await searchCourse(page, code);
        await clickLoadMoreUntilDone(page);
        const text = await page.evaluate(() => document.body.innerText || "");
        const rows = parseReviewsFromText(text, code);
        console.log(`抓到 ${rows.length} 条（${code}）`);
        all.push(...rows);
        doneCodes.push(code);
      } catch (err) {
        console.warn(`查询失败 ${code}：`, err);
        // 页面可能坏了，重新打开再继续
        await page.goto(SHARE_URL, {
          waitUntil: "domcontentloaded",
          timeout: 90_000,
        });
        await waitForQueryReady(page);
      }

      if (opts?.onBatch && (doneCodes.length % 10 === 0 || i === codes.length - 1)) {
        await opts.onBatch(all, doneCodes);
      }
    }
  } finally {
    await browser.close();
  }

  const seen = new Set<string>();
  return all.filter((r) => {
    const key = `${r.course_name}::${r.professor}::${r.review}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function loadCatalogCodeSet() {
  const raw = JSON.parse(
    await readFile(path.resolve(process.cwd(), "data/courses.json"), "utf8")
  ) as Array<{ code: string }>;
  return new Set(
    raw
      .map((c) => resolveCode(c.code ?? ""))
      .filter((c) => Boolean(c))
  );
}

async function loadCatalogCodes(n: number | null, rng: () => number) {
  const codes = Array.from(await loadCatalogCodeSet()).sort();
  if (n == null) return codes;
  const shuffled = [...codes];
  shuffleInPlace(shuffled, rng);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

async function latestScrapeFile() {
  const files = (await readdir(OUT_DIR))
    .filter(
      (f) =>
        f.endsWith(".json") &&
        !f.startsWith("transformed-") &&
        !f.startsWith("sample-ready-") &&
        !f.startsWith("sample-manual") &&
        !f.startsWith("debug-")
    )
    .sort();
  if (!files.length) throw new Error(`未找到抓取文件：${OUT_DIR}`);
  return path.join(OUT_DIR, files[files.length - 1]);
}

/** 只保留网站课程目录里存在的课程代码 */
function filterInCatalog(
  reviews: FeishuReview[],
  catalog: Set<string>
): { kept: FeishuReview[]; dropped: number; droppedCodes: string[] } {
  const kept: FeishuReview[] = [];
  const droppedCodes = new Set<string>();
  let dropped = 0;

  for (const row of reviews) {
    const code = extractCourseCode(row.course_name, row.source_query);
    if (!catalog.has(code)) {
      dropped += 1;
      if (code) droppedCodes.add(code);
      continue;
    }
    kept.push({ ...row, course_name: code });
  }

  return {
    kept,
    dropped,
    droppedCodes: Array.from(droppedCodes).sort(),
  };
}

function prepareRows(
  reviews: FeishuReview[],
  percent: number,
  rng: () => number
) {
  const sampled = samplePercent(reviews, percent, rng);
  const kept: PreparedRow[] = [];
  const discarded: Record<string, number> = {};

  for (const row of sampled) {
    const professor = (row.professor ?? "").trim();
    if (!professor || professor === "无" || professor === "-" || professor.length < 2) {
      discarded["no-professor"] = (discarded["no-professor"] ?? 0) + 1;
      continue;
    }

    const cleaned = cleanReviewText(row.review, { courseType: row.course_type });
    if (!cleaned.ok) {
      for (const reason of cleaned.reasons) {
        discarded[reason] = (discarded[reason] ?? 0) + 1;
      }
      continue;
    }

    const course_code = extractCourseCode(row.course_name, row.source_query);
    kept.push({
      course_code,
      professor_name: professor.slice(0, 40),
      content: cleaned.text,
      recommend_score: row.recommend_score,
      attendance: row.attendance,
      course_type: row.course_type,
      raw_review: row.review,
    });
  }

  return { sampledCount: sampled.length, kept, discarded };
}

async function importRows(
  rows: PreparedRow[],
  target: AdminTarget,
  apply: boolean,
  confirmed: boolean
) {
  if (apply && !confirmed) {
    throw new Error(
      target === "prod"
        ? "写入正式库需要同时传 --apply --confirm-prod"
        : "写入 DEV 需要同时传 --apply --confirm-dev"
    );
  }

  const { client, host, urlKey } = createTargetAdminClient(target);
  console.log(
    `${target === "prod" ? "正式库" : "DEV"} 目标：${host}（来自 ${urlKey}）`
  );

  const probe = await client
    .from("professor_recommendations")
    .select("id, is_imported, source")
    .limit(1);
  const hasImportCols = !probe.error;
  if (!hasImportCols) {
    console.warn(
      "警告：库中尚无 is_imported/source 列。请先在 SQL Editor 执行 supabase/phase10-import-source.sql"
    );
    console.warn(`探测错误：${probe.error?.message}`);
  }

  const needed = Array.from(new Set(rows.map((r) => r.course_code)));
  const { data: courses, error: courseError } = await client
    .from("courses")
    .select("id, code")
    .in("code", needed);
  if (courseError) throw courseError;

  const idByCode = new Map(
    (courses ?? []).map((c) => [c.code as string, c.id as string])
  );
  const missing = needed.filter((c) => !idByCode.has(c));

  const { data: existingRecs, error: existingError } = await client
    .from("professor_recommendations")
    .select("course_id, content")
    .eq("user_id", AUTHOR_USER_ID);
  if (existingError) throw existingError;

  const existingKeys = new Set(
    (existingRecs ?? []).map(
      (r) => `${r.course_id}::${String(r.content).trim()}`
    )
  );

  const toInsert: Array<Record<string, unknown>> = [];
  let skippedDup = 0;
  let skippedMissingCourse = 0;

  for (const row of rows) {
    const courseId = idByCode.get(row.course_code);
    if (!courseId) {
      skippedMissingCourse += 1;
      continue;
    }
    const key = `${courseId}::${row.content.trim()}`;
    if (existingKeys.has(key)) {
      skippedDup += 1;
      continue;
    }
    existingKeys.add(key);
    const base: Record<string, unknown> = {
      course_id: courseId,
      user_id: AUTHOR_USER_ID,
      professor_name: row.professor_name,
      content: row.content,
    };
    if (hasImportCols) {
      base.is_imported = true;
      base.source = IMPORT_SOURCE;
    }
    toInsert.push(base);
  }

  const summary = {
    mode: apply ? "APPLY" : "DRY-RUN",
    target,
    host,
    hasImportCols,
    candidateRows: rows.length,
    missingCourses: missing.slice(0, 30),
    missingCourseCount: missing.length,
    skippedDup,
    skippedMissingCourse,
    willInsert: toInsert.length,
    previews: toInsert.slice(0, 5).map((r) => ({
      course_id: r.course_id,
      professor: r.professor_name,
      content: String(r.content).slice(0, 60),
      source: r.source ?? null,
    })),
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!apply) {
    console.log(
      target === "prod"
        ? "干跑完成。确认无误后加 --apply --confirm-prod 写入正式库。"
        : "干跑完成。确认无误后加 --apply --confirm-dev 写入 DEV。"
    );
    return summary;
  }

  if (!hasImportCols) {
    throw new Error(
      "拒绝写入：请先执行 supabase/phase10-import-source.sql，以便打上 feishu_sample 来源标记并可一键清空。"
    );
  }

  if (toInsert.length === 0) {
    console.log("没有可插入行。");
    return summary;
  }

  const { error } = await client.from("professor_recommendations").insert(toInsert);
  if (error) throw error;

  console.log(
    `已写入${target === "prod" ? "正式库" : " DEV"}：${toInsert.length} 条（source=${IMPORT_SOURCE}）`
  );
  return summary;
}

function resolveImportTarget(args: {
  importDev: boolean;
  importProd: boolean;
}): AdminTarget | null {
  if (args.importProd && args.importDev) {
    throw new Error("不能同时使用 --import-prod 与 --import-dev");
  }
  if (args.importProd) return "prod";
  if (args.importDev) return "dev";
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(OUT_DIR, { recursive: true });
  const rng = args.seed != null && Number.isFinite(args.seed)
    ? mulberry32(args.seed)
    : Math.random;

  // 已清洗的 sample-ready：导入前再按目录过滤一次
  if (args.from && /sample-ready-/.test(args.from)) {
    const readyPath = path.resolve(process.cwd(), args.from);
    const data = JSON.parse(await readFile(readyPath, "utf8")) as {
      rows: PreparedRow[];
      stats?: unknown;
    };
    const catalog = await loadCatalogCodeSet();
    const before = data.rows?.length ?? 0;
    const rows = (data.rows ?? []).filter((r) => catalog.has(r.course_code));
    console.log(`加载已清洗样本：${readyPath}`);
    console.log("stats", data.stats);
    console.log(`目录再校验：${rows.length}/${before} 条在网站课程表中`);

    const target = resolveImportTarget(args);
    if (!target) {
      const rel = path.relative(process.cwd(), readyPath).replace(/\\/g, "/");
      console.log(
        [
          "该文件已完成抽样+清洗。导入正式库：",
          `  npx tsx scripts/feishu-sample-pipeline.ts --from ${rel} --import-prod`,
          `  npx tsx scripts/feishu-sample-pipeline.ts --from ${rel} --import-prod --apply --confirm-prod`,
        ].join("\n")
      );
      return;
    }
    await importRows(
      rows,
      target,
      args.apply,
      target === "prod" ? args.confirmProd : args.confirmDev
    );
    return;
  }

  let reviews: FeishuReview[] = [];
  let scrapePath: string | null = null;

  if (args.from) {
    scrapePath = path.resolve(process.cwd(), args.from);
    const data = JSON.parse(await readFile(scrapePath, "utf8"));
    reviews = (data.reviews ?? data.rows ?? []) as FeishuReview[];
    console.log(`从文件加载 ${reviews.length} 条：${scrapePath}`);
  } else if (args.scrape) {
    let codes = args.codes;
    if (args.catalogAll) {
      codes = await loadCatalogCodes(null, rng);
      console.log(
        `将用网站全部 ${codes.length} 个课程代码，在飞书查询页逐个搜索抓取`
      );
    } else if (args.catalogSample != null) {
      if (!Number.isFinite(args.catalogSample) || args.catalogSample <= 0) {
        throw new Error("--catalog-sample 需要正整数");
      }
      codes = await loadCatalogCodes(args.catalogSample, rng);
      console.log(
        `从课程目录随机抽取 ${codes.length} 门课：`,
        codes.slice(0, 20).join(", "),
        codes.length > 20 ? "..." : ""
      );
    }
    if (!codes.length) {
      throw new Error(
        "请提供课程代码，或使用 --catalog-all / --catalog-sample N，或 --from 已有 JSON"
      );
    }

    const checkpointPath = path.join(OUT_DIR, "feishu-catalog-checkpoint.json");
    let priorReviews: FeishuReview[] = [];
    let alreadyDone = new Set<string>();
    try {
      const prior = JSON.parse(await readFile(checkpointPath, "utf8")) as {
        done_codes?: string[];
        reviews?: FeishuReview[];
      };
      priorReviews = prior.reviews ?? [];
      alreadyDone = new Set(prior.done_codes ?? []);
      if (alreadyDone.size) {
        console.log(
          `发现断点：已完成 ${alreadyDone.size} 门课、${priorReviews.length} 条，将续跑`
        );
      }
    } catch {
      // no checkpoint
    }

    const fresh = await scrapeCodes(codes, args.headed, {
      alreadyDone,
      onBatch: async (batchReviews, doneCodes) => {
        const merged = [...priorReviews, ...batchReviews];
        const seen = new Set<string>();
        const deduped = merged.filter((r) => {
          const key = `${r.course_name}::${r.professor}::${r.review}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        await writeFile(
          checkpointPath,
          `${JSON.stringify(
            {
              source: SHARE_URL,
              updated_at: new Date().toISOString(),
              done_codes: Array.from(
                new Set([...alreadyDone, ...doneCodes])
              ).sort(),
              count: deduped.length,
              reviews: deduped,
            },
            null,
            2
          )}\n`,
          "utf8"
        );
        console.log(
          `checkpoint 已保存：${deduped.length} 条 / 已查 ${alreadyDone.size + doneCodes.length} 门`
        );
      },
    });

    const mergedAll = [...priorReviews, ...fresh];
    const seen = new Set<string>();
    reviews = mergedAll.filter((r) => {
      const key = `${r.course_name}::${r.professor}::${r.review}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    scrapePath = path.join(OUT_DIR, `feishu-raw-catalog-${stamp}.json`);
    await writeFile(
      scrapePath,
      `${JSON.stringify(
        {
          source: SHARE_URL,
          scraped_at: new Date().toISOString(),
          queries: codes,
          count: reviews.length,
          reviews,
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    console.log(`原始抓取已保存：${scrapePath}（${reviews.length} 条）`);
  } else {
    scrapePath = await latestScrapeFile();
    const data = JSON.parse(await readFile(scrapePath, "utf8"));
    reviews = (data.reviews ?? data.rows ?? []) as FeishuReview[];
    console.log(`使用最近抓取 ${reviews.length} 条：${scrapePath}`);
  }

  if (!reviews.length) {
    throw new Error("没有可处理的评价数据");
  }

  const catalog = await loadCatalogCodeSet();
  const catalogFilter = filterInCatalog(reviews, catalog);
  console.log(
    `目录校验：保留 ${catalogFilter.kept.length} / 抓取 ${reviews.length}；丢弃不在网站课程表的 ${catalogFilter.dropped} 条` +
      (catalogFilter.droppedCodes.length
        ? `（如 ${catalogFilter.droppedCodes.slice(0, 15).join(", ")}${catalogFilter.droppedCodes.length > 15 ? "..." : ""}）`
        : "")
  );
  reviews = catalogFilter.kept;
  if (!reviews.length) {
    throw new Error("过滤后无剩余评价：飞书结果中的课程代码均不在 data/courses.json");
  }

  const prepared = prepareRows(reviews, args.samplePercent, rng);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const readyPath = path.join(OUT_DIR, `sample-ready-${stamp}.json`);
  const payload = {
    prepared_at: new Date().toISOString(),
    source_file: scrapePath,
    share_url: SHARE_URL,
    sample_percent: args.samplePercent,
    seed: args.seed,
    policy: {
      import_table: "professor_recommendations",
      source: IMPORT_SOURCE,
      is_imported: true,
      drop: [
        "not-in-catalog",
        "pii",
        "abuse",
        "fully-negative",
        "no-professor",
      ],
      catalog_size: catalog.size,
      target: "prod or dev via --import-prod / --import-dev",
    },
    stats: {
      scraped_raw: catalogFilter.kept.length + catalogFilter.dropped,
      in_catalog: catalogFilter.kept.length,
      dropped_not_in_catalog: catalogFilter.dropped,
      dropped_codes: catalogFilter.droppedCodes,
      sampled: prepared.sampledCount,
      kept_after_clean: prepared.kept.length,
      discarded: prepared.discarded,
    },
    rows: prepared.kept,
  };
  await writeFile(readyPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(payload.stats, null, 2));
  console.log(`抽样+清洗结果：${readyPath}`);

  const target = resolveImportTarget(args);
  if (!target) {
    const rel = path.relative(process.cwd(), readyPath).replace(/\\/g, "/");
    console.log(
      [
        "",
        "下一步（先在正式库执行 phase10 SQL，再导入）：",
        `  npx tsx scripts/feishu-sample-pipeline.ts --from ${rel} --import-prod`,
        `  npx tsx scripts/feishu-sample-pipeline.ts --from ${rel} --import-prod --apply --confirm-prod`,
      ].join("\n")
    );
    return;
  }

  await importRows(
    prepared.kept,
    target,
    args.apply,
    target === "prod" ? args.confirmProd : args.confirmDev
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
