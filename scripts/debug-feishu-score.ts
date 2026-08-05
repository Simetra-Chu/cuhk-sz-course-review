/**
 * 调试：抓 ENG1001 一条结果，看推荐评分在文本/API 里长什么样
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const SHARE_URL =
  "https://blankspace.feishu.cn/share/base/query/shrcnbdLnH8R7q0OjN2bPLHnFMd";
const OUT = path.resolve("data/feishu-scrapes");

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    locale: "zh-CN",
    viewport: { width: 1400, height: 900 },
  });

  const apiHits: Array<{ url: string; body: string }> = [];
  page.on("response", async (res) => {
    const url = res.url();
    if (!/list_records|record|bitable|share/i.test(url)) return;
    try {
      const text = await res.text();
      if (text.length > 2_000_000) return;
      if (/课程|评分|recommend|fields/i.test(text) || url.includes("list_records")) {
        apiHits.push({ url, body: text.slice(0, 800_000) });
      }
    } catch {
      // ignore
    }
  });

  await page.goto(SHARE_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector(
    'button:has-text("查询"), button:has-text("Search"), button:has-text("搜索")',
    { timeout: 60_000 }
  );
  const inputs = page.locator(
    'input[placeholder="请输入"], input[placeholder="Enter here"]'
  );
  await inputs.nth(0).fill("ENG1001");
  await page
    .locator('button:has-text("查询"), button:has-text("Search"), button:has-text("搜索")')
    .first()
    .click();
  await page.waitForTimeout(4000);

  // load more a couple times
  for (let i = 0; i < 3; i += 1) {
    const btn = page.locator(
      'button:has-text("加载更多"), button:has-text("Load More")'
    ).first();
    if ((await btn.count()) === 0 || !(await btn.isVisible().catch(() => false))) break;
    await btn.click().catch(() => undefined);
    await page.waitForTimeout(1200);
  }

  const text = await page.evaluate(() => document.body.innerText || "");
  const htmlSnippet = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll("*"))
      .filter((el) => /课程推荐评分|推荐评分/.test(el.textContent || ""))
      .slice(0, 20)
      .map((el) => ({
        tag: el.tagName,
        cls: (el as HTMLElement).className?.toString?.().slice(0, 80),
        text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 200),
      }));
    return labels;
  });

  // look for rating widgets near 评分
  const ratingProbe = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("[aria-label], [class*='rate'], [class*='star'], [class*='score']"));
    return all.slice(0, 40).map((el) => ({
      tag: el.tagName,
      aria: el.getAttribute("aria-label"),
      cls: (el as HTMLElement).className?.toString?.().slice(0, 100),
      text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
    }));
  });

  const idx = text.indexOf("课程推荐评分");
  const around =
    idx >= 0 ? text.slice(Math.max(0, idx - 80), idx + 200) : "(label not found)";

  await writeFile(
    path.join(OUT, "debug-score-probe.json"),
    JSON.stringify(
      {
        aroundScoreLabel: around,
        htmlSnippet,
        ratingProbe,
        apiHitCount: apiHits.length,
        apiUrls: apiHits.map((a) => a.url).slice(0, 30),
        apiBodies: apiHits.slice(0, 5).map((a) => ({
          url: a.url,
          preview: a.body.slice(0, 4000),
        })),
        textPreview: text.slice(0, 3000),
      },
      null,
      2
    )
  );

  // save largest API body if any
  if (apiHits.length) {
    const biggest = apiHits.sort((a, b) => b.body.length - a.body.length)[0];
    await writeFile(
      path.join(OUT, "debug-score-api-largest.json"),
      biggest.body
    );
    console.log("largest api", biggest.url, biggest.body.length);
  }

  await browser.close();
  console.log("wrote debug-score-probe.json; apiHits", apiHits.length);
  console.log("around:", around);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
