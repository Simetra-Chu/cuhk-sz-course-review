/**
 * 抓取飞书「卡园LGU收集」选课评价查询页
 *
 * 用法：
 *   npx tsx scripts/scrape-feishu-reviews.ts
 *   npx tsx scripts/scrape-feishu-reviews.ts ENG1001 ACT2111
 *   npx tsx scripts/scrape-feishu-reviews.ts --headed ENG1001
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright";

const SHARE_URL =
  "https://blankspace.feishu.cn/share/base/query/shrcnbdLnH8R7q0OjN2bPLHnFMd";

const OUT_DIR = path.resolve(process.cwd(), "data", "feishu-scrapes");

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

function parseArgs(argv: string[]) {
  const headed = argv.includes("--headed");
  const codes = argv.filter((a) => !a.startsWith("--") && a.trim());
  return {
    headed,
    codes: codes.length > 0 ? codes : ["ENG1001"],
  };
}

async function waitForQueryReady(page: Page) {
  await page.waitForSelector(
    'button:has-text("查询"), button:has-text("Search"), button:has-text("搜索")',
    {
    timeout: 60_000,
  });
  await page.waitForSelector('input[placeholder="Enter here"], input[placeholder="请输入"]', {
    timeout: 60_000,
  });
}

async function searchCourse(page: Page, courseCode: string) {
  const inputs = page.locator(
    'input[placeholder="Enter here"], input[placeholder="请输入"]'
  );
  await inputs.nth(0).fill("");
  await inputs.nth(0).fill(courseCode);

  // 清空老师 / 院系，避免残留过滤
  const count = await inputs.count();
  for (let i = 1; i < Math.min(count, 3); i += 1) {
    await inputs.nth(i).fill("");
  }

  const searchBtn = page
    .locator('button:has-text("查询"), button:has-text("Search"), button:has-text("搜索")')
    .first();
  await searchBtn.click();

  // 等待结果或空状态
  await page.waitForTimeout(2000);
  await Promise.race([
    page.waitForFunction(
      () =>
        /results|条结果|Load More|加载更多|No results|暂无|没有|课程评价/.test(
          document.body.innerText
        ),
      { timeout: 45_000 }
    ),
    page.waitForTimeout(5000),
  ]);
}

async function clickLoadMoreUntilDone(page: Page) {
  for (let i = 0; i < 80; i += 1) {
    const loadMore = page
      .locator('button:has-text("Load More"), button:has-text("加载更多")')
      .first();
    if ((await loadMore.count()) === 0) break;
    if (!(await loadMore.isVisible().catch(() => false))) break;

    const before = await page.evaluate(() => document.body.innerText.length);
    await loadMore.click().catch(() => undefined);
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => document.body.innerText.length);
    if (after <= before + 20) {
      // 可能到底了或点击无效
      await page.waitForTimeout(800);
      if (!(await loadMore.isVisible().catch(() => false))) break;
    }
  }
}

function parseReviewsFromText(text: string, sourceQuery: string): FeishuReview[] {
  // 去掉页头查询区，从结果区开始更稳
  const marker = text.match(/\d+\s+results|共\s*\d+\s*条/);
  const body = marker
    ? text.slice(text.indexOf(marker[0]))
    : text;

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

function pickField(block: string, label: string, stopLabels: string[]) {
  const start = block.indexOf(`\n${label}\n`);
  const altStart = block.startsWith(`${label}\n`) ? 0 : -1;
  const idx = start >= 0 ? start + label.length + 2 : altStart === 0 ? label.length + 1 : -1;
  if (idx < 0) return "";

  let end = block.length;
  for (const stop of stopLabels) {
    const p = block.indexOf(`\n${stop}\n`, idx);
    if (p >= 0) end = Math.min(end, p);
  }
  return block.slice(idx, end).trim();
}

function clean(value: string) {
  return value
    .replace(/\u200b/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

async function scrapeOne(page: Page, courseCode: string) {
  console.log(`\n==> 查询 ${courseCode}`);
  await page.goto(SHARE_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await waitForQueryReady(page);
  await searchCourse(page, courseCode);
  await clickLoadMoreUntilDone(page);

  const text = await page.evaluate(() => document.body.innerText || "");
  const reviews = parseReviewsFromText(text, courseCode);
  console.log(`抓到 ${reviews.length} 条（${courseCode}）`);
  return reviews;
}

async function main() {
  const { headed, codes } = parseArgs(process.argv.slice(2));
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({
    locale: "zh-CN",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  const all: FeishuReview[] = [];
  try {
    for (const code of codes) {
      const rows = await scrapeOne(page, code);
      all.push(...rows);
    }
  } finally {
    await browser.close();
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(
    OUT_DIR,
    `feishu-reviews-${codes.join("_")}-${stamp}.json`
  );
  const payload = {
    source: SHARE_URL,
    scraped_at: new Date().toISOString(),
    queries: codes,
    count: all.length,
    reviews: all,
  };
  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`\n完成：${all.length} 条`);
  console.log(`已保存：${outPath}`);
  if (all[0]) {
    console.log("样例：", JSON.stringify(all[0], null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
