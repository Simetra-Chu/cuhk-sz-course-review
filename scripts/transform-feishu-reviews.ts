/**
 * 飞书表格评价 → 同义改写 → 仅写入「教授评价」
 * - 正面 / 中性：进入 professor_recommendations
 * - 完全负面：丢弃
 * - 不进入评论区
 *
 *   npx tsx scripts/transform-feishu-reviews.ts [input.json]
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.resolve(process.cwd(), "data", "feishu-scrapes");

export type RawFeishuReview = {
  course_name?: string;
  professor?: string;
  attendance?: string;
  course_type?: string;
  assessment?: string[] | string;
  review?: string;
  recommend_score?: string;
  department?: string;
  checkin_method?: string;
  source_query?: string;
};

export type TransformedProfessorRec = {
  course_code: string;
  professor_name: string;
  content: string;
  sentiment: "positive" | "neutral";
  tags: string[];
  source_hint: string;
};

/** 轻量同义替换：改几个字，保留口语 */
const SYNONYM_PAIRS: Array<[RegExp, string]> = [
  [/非常好的/g, "挺不错的"],
  [/超级好的/g, "特别不错的"],
  [/非常好/g, "挺好"],
  [/超级好/g, "特别好"],
  [/很好/g, "不错"],
  [/特别好/g, "挺不错"],
  [/人很好/g, "人挺好"],
  [/老师很好/g, "老师挺不错"],
  [/无脑冲/g, "可以冲"],
  [/无脑选/g, "能选"],
  [/强烈推荐/g, "比较推荐"],
  [/不推荐/g, "不太建议"],
  [/避雷/g, "慎选"],
  [/爆爱/g, "很喜欢"],
  [/workload/gi, "作业量"],
  [/WL/g, "作业量"],
  [/wl/g, "作业量"],
  [/给分高/g, "给分偏松"],
  [/给分低/g, "给分偏紧"],
  [/给分好/g, "给分还行"],
  [/严格/g, "要求高"],
  [/水课/g, "比较轻松"],
  [/点名/g, "签到"],
  [/傻逼/g, "体验一般"],
  [/垃圾/g, "不太行"],
  [/坑/g, "要谨慎"],
];

const POSITIVE_MARKERS = [
  "挺好",
  "不错",
  "温柔",
  "耐心",
  "推荐",
  "喜欢",
  "负责任",
  "清楚",
  "幽默",
  "给分偏松",
  "给分还行",
  "人挺好",
  "可以冲",
  "能选",
  "平易近人",
  "详细",
  "答疑",
  "友好",
];

const FULLY_NEGATIVE_MARKERS = [
  "慎选",
  "避雷",
  "不太建议",
  "不太行",
  "很难听",
  "体验一般",
  "千万别",
  "别选",
  "建议慎选",
  "要谨慎",
  "蛇蝎",
];

function normalizeCourseCode(raw: string) {
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

function paraphraseColloquial(input: string) {
  let text = input.trim();
  if (!text) return text;

  for (const [pattern, replacement] of SYNONYM_PAIRS) {
    text = text.replace(pattern, replacement);
  }

  text = text
    .replace(/！+/g, "！")
    .replace(/。{2,}/g, "。")
    .replace(/，{2,}/g, "，");

  if (
    text.length >= 8 &&
    !/[了呢吧啊呀]$/.test(text) &&
    text.length % 3 === 0 &&
    !/[！？]$/.test(text)
  ) {
    text = `${text}吧`;
  }

  return text.trim();
}

function attendanceTag(attendance?: string) {
  const a = (attendance ?? "").trim();
  if (!a) return null;
  if (/很少|几乎不|不签|无签/.test(a)) return "签到少";
  if (/每节|总是|经常|频繁/.test(a)) return "点名频繁";
  if (/偶尔|有时/.test(a)) return "偶尔签到";
  return null;
}

function inferTags(text: string, row: RawFeishuReview) {
  const tags = new Set<string>();
  const attend = attendanceTag(row.attendance);
  if (attend) tags.add(attend);

  const assessment = Array.isArray(row.assessment)
    ? row.assessment
    : String(row.assessment ?? "")
        .split(/\n+/)
        .map((x) => x.trim())
        .filter(Boolean);
  const joined = assessment.join(" ");
  if (/论文|essay/i.test(joined)) tags.add("有论文");
  if (/presentation|展示|汇报/i.test(joined)) tags.add("有展示");
  if (/闭卷|考试|期末/i.test(joined)) tags.add("有考试");

  if (/给分偏松|给分还行|给分不错/.test(text)) tags.add("给分慷慨");
  if (/给分偏紧|给分严格|要求高/.test(text)) tags.add("给分严格");
  if (/作业量小|作业不多|作业适中|作业量不大/.test(text)) tags.add("作业适中");
  if (/作业量大|作业量偏大|很累/.test(text)) tags.add("作业量大");

  return Array.from(tags).slice(0, 8);
}

/** 仅丢弃「完全负面」；正面与中性都保留 */
function isFullyNegative(text: string, courseType?: string) {
  const type = (courseType ?? "").trim();
  if (/避雷|不喜欢|慎选/.test(type) && !/爆爱|喜欢|推荐/.test(type)) {
    return true;
  }

  const hasStrongNeg = FULLY_NEGATIVE_MARKERS.some((m) => text.includes(m));
  const hasPos = POSITIVE_MARKERS.some((m) => text.includes(m));

  // 明确劝退且没有正面表述 → 丢弃
  if (hasStrongNeg && !hasPos) return true;
  if (/建议慎选|别选这门|千万别选/.test(text) && !hasPos) return true;

  return false;
}

function sentimentOf(text: string, courseType?: string): "positive" | "neutral" {
  const type = courseType ?? "";
  if (/爆爱|喜欢|推荐/.test(type)) return "positive";
  if (POSITIVE_MARKERS.some((m) => text.includes(m))) return "positive";
  return "neutral";
}

function hasProfessor(name?: string) {
  const n = (name ?? "").trim();
  if (!n || n === "无" || n === "-" || n === "未知") return false;
  return n.length >= 2 && n.length <= 40;
}

export function transformRow(row: RawFeishuReview): {
  professorRec: TransformedProfessorRec | null;
  discarded: boolean;
  reason?: string;
} {
  const original = (row.review ?? "").trim();
  if (!original) {
    return { professorRec: null, discarded: true, reason: "empty" };
  }

  const paraphrased = paraphraseColloquial(original);
  if (!paraphrased) {
    return { professorRec: null, discarded: true, reason: "empty-after-paraphrase" };
  }

  const course_code = normalizeCourseCode(
    row.course_name ?? row.source_query ?? ""
  );
  if (!course_code) {
    return { professorRec: null, discarded: true, reason: "no-course" };
  }

  if (!hasProfessor(row.professor)) {
    return { professorRec: null, discarded: true, reason: "no-professor" };
  }

  if (isFullyNegative(paraphrased, row.course_type)) {
    return { professorRec: null, discarded: true, reason: "fully-negative" };
  }

  const tags = inferTags(paraphrased, row);
  const professor_name = row.professor!.trim().slice(0, 40);

  return {
    discarded: false,
    professorRec: {
      course_code,
      professor_name,
      content: paraphrased.slice(0, 2000),
      sentiment: sentimentOf(paraphrased, row.course_type),
      tags,
      source_hint: "feishu-lgu-professor-only",
    },
  };
}

async function loadInput(explicit?: string) {
  if (explicit) {
    return JSON.parse(await readFile(path.resolve(process.cwd(), explicit), "utf8"));
  }
  const files = (await readdir(OUT_DIR))
    .filter((f) => f.endsWith(".json") && !f.startsWith("transformed-"))
    .sort();
  if (!files.length) throw new Error(`未找到抓取文件：${OUT_DIR}`);
  const latest = path.join(OUT_DIR, files[files.length - 1]);
  console.log(`使用输入：${latest}`);
  return JSON.parse(await readFile(latest, "utf8"));
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const inputPath = process.argv[2];
  const data = await loadInput(inputPath);
  const rows = (data.reviews ?? data.rows ?? []) as RawFeishuReview[];

  const professorRecs: TransformedProfessorRec[] = [];
  let discarded = 0;
  const discardReasons: Record<string, number> = {};

  for (const row of rows) {
    const result = transformRow(row);
    if (result.discarded || !result.professorRec) {
      discarded += 1;
      const key = result.reason ?? "unknown";
      discardReasons[key] = (discardReasons[key] ?? 0) + 1;
      continue;
    }
    professorRecs.push(result.professorRec);
  }

  // 同课同教授合并
  const merged = new Map<string, TransformedProfessorRec>();
  for (const rec of professorRecs) {
    const key = `${rec.course_code}::${rec.professor_name.toLowerCase()}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...rec });
      continue;
    }
    if (!existing.content.includes(rec.content)) {
      existing.content = `${existing.content}\n\n——\n\n${rec.content}`.slice(
        0,
        2000
      );
    }
    existing.tags = Array.from(new Set([...existing.tags, ...rec.tags])).slice(
      0,
      8
    );
    if (rec.sentiment === "positive") existing.sentiment = "positive";
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(OUT_DIR, `transformed-${stamp}.json`);
  const payload = {
    transformed_at: new Date().toISOString(),
    policy:
      "professor-recommendations only; keep positive+neutral; drop fully-negative; no discussion comments",
    source_file: inputPath ?? "latest-scrape",
    stats: {
      input: rows.length,
      professor_recs: merged.size,
      discarded,
      discardReasons,
      comments: 0,
    },
    comments: [] as unknown[],
    professor_recommendations: Array.from(merged.values()),
  };

  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(payload.stats, null, 2));
  console.log(`已写出：${outPath}`);
  const sample = Array.from(merged.values())[0];
  if (sample) console.log("样例：", JSON.stringify(sample, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
