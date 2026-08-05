/**
 * 通过飞书 share query 的 list_records API 抓取评价（含 1–5 推荐评分）
 */
import { chromium, type Page } from "playwright";

const SHARE_URL =
  "https://blankspace.feishu.cn/share/base/query/shrcnbdLnH8R7q0OjN2bPLHnFMd";

export const FEISHU_FIELD = {
  course: "fldTImGPzL",
  professor: "fldqEkXYKO",
  attendance: "fldlic0gkr",
  courseType: "fld9d8sKvt",
  assessment: "fldyMCBmpg",
  review: "fldjqDEwqA",
  score: "fldUE694nM",
  department: "fld6wRYnkY",
  intro: "fldeAjbQk2",
  difficultyText: "fld9hEn4bt",
} as const;

export type FeishuApiReview = {
  record_id: string;
  course_name: string;
  professor: string;
  attendance: string;
  course_type: string;
  assessment: string[];
  review: string;
  recommend_score: number | null;
  department: string;
  difficulty_text: string;
  source_query: string;
};

type FieldMap = Record<
  string,
  {
    name?: string;
    property?: {
      options?: Array<{ id: string; name: string }>;
    };
  }
>;

function textValue(cell: unknown): string {
  if (!cell || typeof cell !== "object") return "";
  const value = (cell as { value?: unknown }).value;
  if (typeof value === "string" || typeof value === "number") {
    return String(value).replace(/\u200b/g, "").trim();
  }
  if (!Array.isArray(value)) return "";
  return value
    .map((v) => {
      if (typeof v === "string") return v;
      if (v && typeof v === "object" && "text" in v) {
        return String((v as { text: string }).text ?? "");
      }
      return "";
    })
    .join("")
    .replace(/\u200b/g, "")
    .trim();
}

function optionNames(
  cell: unknown,
  fieldId: string,
  fieldMap: FieldMap
): string[] {
  if (!cell || typeof cell !== "object") return [];
  const value = (cell as { value?: unknown }).value;
  const options = fieldMap[fieldId]?.property?.options ?? [];
  const byId = new Map(options.map((o) => [o.id, o.name]));
  const ids = Array.isArray(value) ? value : value ? [value] : [];
  return ids
    .map((id) => byId.get(String(id)) ?? "")
    .filter(Boolean);
}

function scoreValue(cell: unknown): number | null {
  if (!cell || typeof cell !== "object") return null;
  const value = (cell as { value?: unknown }).value;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 5) return null;
  return Math.round(n);
}

function parseRecord(
  recordId: string,
  fields: Record<string, unknown>,
  fieldMap: FieldMap,
  sourceQuery: string
): FeishuApiReview | null {
  const course_name = textValue(fields[FEISHU_FIELD.course]).replace(/\s+/g, "");
  const review = textValue(fields[FEISHU_FIELD.review]);
  if (!course_name && !review) return null;

  const attendanceOpts = optionNames(
    fields[FEISHU_FIELD.attendance],
    FEISHU_FIELD.attendance,
    fieldMap
  );
  const typeOpts = optionNames(
    fields[FEISHU_FIELD.courseType],
    FEISHU_FIELD.courseType,
    fieldMap
  );
  const assessOpts = optionNames(
    fields[FEISHU_FIELD.assessment],
    FEISHU_FIELD.assessment,
    fieldMap
  );

  return {
    record_id: recordId,
    course_name: course_name || sourceQuery,
    professor: textValue(fields[FEISHU_FIELD.professor]),
    attendance: attendanceOpts.join("、"),
    course_type: typeOpts[0] ?? textValue(fields[FEISHU_FIELD.courseType]),
    assessment: assessOpts,
    review,
    recommend_score: scoreValue(fields[FEISHU_FIELD.score]),
    department: textValue(fields[FEISHU_FIELD.department]),
    difficulty_text: textValue(fields[FEISHU_FIELD.difficultyText]),
    source_query: sourceQuery,
  };
}

async function waitReady(page: Page) {
  await page.waitForSelector('button:has-text("查询")', { timeout: 60_000 });
  await page.waitForSelector('input[placeholder="请输入"]', { timeout: 60_000 });
}

/**
 * 对每个课程代码查询飞书，合并 list_records 结果
 */
export async function scrapeFeishuViaApi(
  codes: string[],
  opts?: {
    headed?: boolean;
    alreadyDone?: Set<string>;
    onBatch?: (
      reviews: FeishuApiReview[],
      doneCodes: string[],
      fieldMap: FieldMap
    ) => Promise<void>;
  }
): Promise<{ reviews: FeishuApiReview[]; fieldMap: FieldMap }> {
  const browser = await chromium.launch({ headless: !opts?.headed });
  const page = await browser.newPage({
    locale: "zh-CN",
    viewport: { width: 1280, height: 900 },
  });

  let fieldMap: FieldMap = {};
  const byRecord = new Map<string, FeishuApiReview>();
  const doneCodes: string[] = [];
  const skip = opts?.alreadyDone ?? new Set<string>();

  const ingestPayload = (payload: unknown, sourceQuery: string) => {
    const data = (payload as { data?: { recordMap?: Record<string, Record<string, unknown>>; recordIDs?: string[] } })
      ?.data;
    if (!data?.recordMap) return 0;
    let n = 0;
    for (const [id, fields] of Object.entries(data.recordMap)) {
      const row = parseRecord(id, fields, fieldMap, sourceQuery);
      if (!row) continue;
      byRecord.set(id, row);
      n += 1;
    }
    return n;
  };

  page.on("response", async (res) => {
    const url = res.url();
    try {
      if (url.includes("get_share")) {
        const json = await res.json();
        const raw = json?.data?.data;
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (parsed?.fieldMap) fieldMap = parsed.fieldMap;
      }
    } catch {
      // ignore
    }
  });

  try {
    console.log(`打开查询页：${SHARE_URL}`);
    await page.goto(SHARE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await waitReady(page);

    for (let i = 0; i < codes.length; i += 1) {
      const code = codes[i];
      if (skip.has(code)) {
        console.log(`[${i + 1}/${codes.length}] 跳过已抓：${code}`);
        continue;
      }

      console.log(`\n[${i + 1}/${codes.length}] ==> API 查询 ${code}`);
      const batchPayloads: unknown[] = [];
      const onResp = async (res: { url: () => string; json: () => Promise<unknown> }) => {
        if (!res.url().includes("list_records")) return;
        try {
          batchPayloads.push(await res.json());
        } catch {
          // ignore
        }
      };
      page.on("response", onResp);

      try {
        const inputs = page.locator('input[placeholder="请输入"]');
        await inputs.nth(0).fill("");
        await inputs.nth(0).fill(code);
        const count = await inputs.count();
        for (let j = 1; j < Math.min(count, 3); j += 1) {
          await inputs.nth(j).fill("");
        }
        await page.locator('button:has-text("查询")').first().click();
        await page.waitForTimeout(2200);

        for (let k = 0; k < 80; k += 1) {
          const loadMore = page.locator('button:has-text("加载更多")').first();
          if ((await loadMore.count()) === 0) break;
          if (!(await loadMore.isVisible().catch(() => false))) break;
          const before = batchPayloads.length;
          await loadMore.click().catch(() => undefined);
          await page.waitForTimeout(1100);
          if (batchPayloads.length === before) {
            await page.waitForTimeout(600);
            if (!(await loadMore.isVisible().catch(() => false))) break;
          }
        }

        let added = 0;
        for (const payload of batchPayloads) {
          added += ingestPayload(payload, code);
        }
        console.log(
          `抓到本批 payload ${batchPayloads.length}，累计去重 ${byRecord.size}（本课新增约 ${added}）`
        );
        doneCodes.push(code);

        if (
          opts?.onBatch &&
          (doneCodes.length % 10 === 0 || i === codes.length - 1)
        ) {
          await opts.onBatch(Array.from(byRecord.values()), doneCodes, fieldMap);
        }
      } catch (err) {
        console.warn(`查询失败 ${code}:`, err);
        await page.goto(SHARE_URL, {
          waitUntil: "domcontentloaded",
          timeout: 90_000,
        });
        await waitReady(page);
      } finally {
        page.off("response", onResp);
      }
    }
  } finally {
    await browser.close();
  }

  return { reviews: Array.from(byRecord.values()), fieldMap };
}
