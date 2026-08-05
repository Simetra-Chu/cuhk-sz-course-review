/**
 * 抓取飞书 Base 分享视图（表格）可见行
 * https://blankspace.feishu.cn/share/base/view/shrcnctnLSH9AJM4DCkEYaOC1ue
 *
 *   npx tsx scripts/scrape-feishu-base-view.ts
 *   npx tsx scripts/scrape-feishu-base-view.ts --headed --max-scrolls 40
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const VIEW_URL =
  "https://blankspace.feishu.cn/share/base/view/shrcnctnLSH9AJM4DCkEYaOC1ue";
const OUT_DIR = path.resolve(process.cwd(), "data", "feishu-scrapes");

type Row = {
  course_name: string;
  professor: string;
  attendance: string;
  review: string;
  checkin_method: string;
  department: string;
  date?: string;
};

function parseArgs(argv: string[]) {
  const headed = argv.includes("--headed");
  const maxIdx = argv.indexOf("--max-scrolls");
  const maxScrolls =
    maxIdx >= 0 && argv[maxIdx + 1] ? Number(argv[maxIdx + 1]) : 60;
  return { headed, maxScrolls: Number.isFinite(maxScrolls) ? maxScrolls : 60 };
}

function parseLooseRows(text: string): Row[] {
  // 视图里整页文本不稳定，尽量按「课程代码 + 老师 + 评价」启发式切分
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/\u200b/g, "").trim())
    .filter(Boolean);

  const rows: Row[] = [];
  const courseLike =
    /^(?:[A-Z]{2,4}\s?\d{3,4}[A-Z]?|\d{4}[A-Za-z]?|[A-Z]{2,4}\d{4})$/i;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!courseLike.test(line.replace(/\s+/g, ""))) continue;

    const course_name = line.replace(/\s+/g, "");
    // 向后取老师 / 评价候选
    const window = lines.slice(i + 1, i + 12);
    const attendance =
      window.find((w) => /很少|经常|偶尔|每节|不签/.test(w)) ?? "";
    const checkin_method =
      window.find((w) => /不签到|签到|其他/.test(w) && w.length <= 8) ?? "";
    const department =
      window.find((w) => /经管|理工|人文|SME|HSS|SDS|SSE|医学院/.test(w)) ??
      "";
    const professor =
      window.find(
        (w) =>
          w.length >= 2 &&
          w.length <= 40 &&
          !/很少|经常|偶尔|不签|签到|经管|Filter|Group|Sort|Row/.test(w) &&
          !courseLike.test(w.replace(/\s+/g, ""))
      ) ?? "";
    const review =
      window.find(
        (w) =>
          w.length >= 6 &&
          !/很少|经常|偶尔|不签到|签到|经管|SME|HSS|Filter|Group/.test(w) &&
          w !== professor
      ) ?? "";

    if (!review) continue;
    rows.push({
      course_name,
      professor,
      attendance,
      review,
      checkin_method,
      department,
    });
  }

  // 去重
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = `${r.course_name}::${r.professor}::${r.review}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main() {
  const { headed, maxScrolls } = parseArgs(process.argv.slice(2));
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: !headed });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    locale: "zh-CN",
  });

  const collected = new Map<string, Row>();

  try {
    await page.goto(VIEW_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(4000);

    for (let i = 0; i < maxScrolls; i += 1) {
      const text = await page.evaluate(() => document.body.innerText || "");
      for (const row of parseLooseRows(text)) {
        collected.set(
          `${row.course_name}::${row.professor}::${row.review}`,
          row
        );
      }

      // 优先滚表格区域
      await page.mouse.move(700, 500);
      await page.mouse.wheel(0, 1400);
      await page.keyboard.press("PageDown").catch(() => undefined);
      await page.waitForTimeout(700);

      if (i % 10 === 0) {
        console.log(`scroll=${i} unique=${collected.size}`);
      }
    }
  } finally {
    await browser.close();
  }

  const reviews = Array.from(collected.values());
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(OUT_DIR, `feishu-view-${stamp}.json`);
  await writeFile(
    outPath,
    `${JSON.stringify(
      {
        source: VIEW_URL,
        scraped_at: new Date().toISOString(),
        count: reviews.length,
        reviews,
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  console.log(`完成：${reviews.length} 条 → ${outPath}`);
  if (reviews[0]) console.log("样例：", JSON.stringify(reviews[0], null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
