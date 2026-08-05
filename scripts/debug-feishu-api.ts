/**
 * 拦截飞书 list_records，提取字段结构（含推荐评分）
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const SHARE_URL =
  "https://blankspace.feishu.cn/share/base/query/shrcnbdLnH8R7q0OjN2bPLHnFMd";
const OUT = path.resolve("data/feishu-scrapes");

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ locale: "zh-CN" });

  const records: unknown[] = [];
  const metas: unknown[] = [];

  page.on("response", async (res) => {
    const url = res.url();
    if (!url.includes("list_records") && !url.includes("get_share")) return;
    try {
      const json = await res.json();
      if (url.includes("get_share")) metas.push(json);
      if (url.includes("list_records")) {
        records.push(json);
      }
    } catch {
      // ignore
    }
  });

  await page.goto(SHARE_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector('button:has-text("查询")', { timeout: 60_000 });
  await page.locator('input[placeholder="请输入"]').nth(0).fill("ENG1001");
  await page.locator('button:has-text("查询")').first().click();
  await page.waitForTimeout(5000);
  for (let i = 0; i < 5; i += 1) {
    const btn = page.locator('button:has-text("加载更多")').first();
    if ((await btn.count()) === 0 || !(await btn.isVisible().catch(() => false)))
      break;
    await btn.click().catch(() => undefined);
    await page.waitForTimeout(1500);
  }

  await writeFile(
    path.join(OUT, "debug-list-records.json"),
    JSON.stringify({ metas, records }, null, 2)
  );

  // summarize first record fields
  const first = records[0] as {
    data?: { records?: Array<{ fields?: Record<string, unknown> }> };
  };
  const sample = first?.data?.records?.[0]?.fields;
  console.log("list_records batches", records.length);
  console.log("sample fields keys", sample ? Object.keys(sample) : null);
  console.log("sample fields", JSON.stringify(sample, null, 2)?.slice(0, 3000));

  // try find rating-like values across first batch
  const all = (first?.data?.records ?? []).slice(0, 5);
  for (const r of all) {
    console.log("---");
    console.log(JSON.stringify(r.fields, null, 2).slice(0, 1500));
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
