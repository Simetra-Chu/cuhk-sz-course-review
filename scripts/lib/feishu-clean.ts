/**
 * 飞书评价清洗：隐私脱敏 + 过激言论过滤
 */

const PII_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "wechat", re: /(?:微信|微信号|vx|v信|wx)[:：\s]*[a-zA-Z][\w-]{4,}/gi },
  { name: "wechat_loose", re: /(?:加我|私我|联系我).{0,8}(?:微信|vx|v信|wx)/gi },
  { name: "qq", re: /(?:QQ|qq|扣扣)[:：\s]*\d{5,12}/g },
  { name: "phone", re: /(?<!\d)(?:1[3-9]\d{9})(?!\d)/g },
  { name: "email", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  // 学号常见 8–12 位纯数字（排除课程代码中的数字片段已由上下文限制）
  { name: "student_id", re: /(?:学号|SID|sid)[:：\s]*\d{6,12}/gi },
  { name: "student_id_bare", re: /(?<![A-Za-z])(?:1[12]\d{6,10})(?![A-Za-z0-9])/g },
  { name: "name_claim", re: /(?:我叫|我是|本人)[\u4e00-\u9fff]{2,4}(?![老师教授])/g },
];

const ABUSE_PATTERNS: RegExp[] = [
  /傻[逼叉笔]/,
  /智障|脑残|白痴|去死|滚蛋|他妈的|妈的|操[死你了]|日你|草泥马|nmsl/i,
  /滚[蛋开]/,
  /人渣|畜生|去死吧/,
  /死全家|咒你/,
];

const FULLY_NEGATIVE_MARKERS = [
  "慎选",
  "避雷",
  "不太建议",
  "不太行",
  "很难听",
  "千万别",
  "别选",
  "建议慎选",
  "要谨慎",
  "蛇蝎",
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
  "给分",
  "人挺好",
  "可以冲",
  "能选",
  "平易近人",
  "详细",
  "答疑",
  "友好",
  "爆爱",
];

export type CleanResult = {
  ok: boolean;
  text: string;
  reasons: string[];
};

export function stripPii(text: string): { text: string; hits: string[] } {
  let out = text;
  const hits: string[] = [];
  for (const { name, re } of PII_PATTERNS) {
    if (re.test(out)) {
      hits.push(name);
      out = out.replace(re, "[已脱敏]");
    }
    re.lastIndex = 0;
  }
  return { text: out, hits };
}

export function hasAbuse(text: string): boolean {
  return ABUSE_PATTERNS.some((re) => re.test(text));
}

/** 完全负面且无正面表述 → 丢弃（与现有教授评价策略一致） */
export function isFullyNegative(text: string, courseType?: string): boolean {
  const type = (courseType ?? "").trim();
  if (/避雷|不喜欢|慎选/.test(type) && !/爆爱|喜欢|推荐/.test(type)) {
    return true;
  }
  const hasStrongNeg = FULLY_NEGATIVE_MARKERS.some((m) => text.includes(m));
  const hasPos = POSITIVE_MARKERS.some((m) => text.includes(m));
  if (hasStrongNeg && !hasPos) return true;
  if (/建议慎选|别选这门|千万别选/.test(text) && !hasPos) return true;
  return false;
}

export function cleanReviewText(
  raw: string,
  opts?: { courseType?: string; allowPiiRedaction?: boolean }
): CleanResult {
  const reasons: string[] = [];
  let text = (raw ?? "").replace(/\u200b/g, "").trim();
  if (!text) {
    return { ok: false, text: "", reasons: ["empty"] };
  }

  if (hasAbuse(text)) {
    return { ok: false, text, reasons: ["abuse"] };
  }

  const { text: redacted, hits } = stripPii(text);
  if (hits.length) {
    // 隐私内容一律丢弃整条，而不是带着脱敏占位符入库
    return { ok: false, text: redacted, reasons: [`pii:${hits.join(",")}`] };
  }

  if (isFullyNegative(text, opts?.courseType)) {
    return { ok: false, text, reasons: ["fully-negative"] };
  }

  // 轻度同义替换（降激进口语）
  text = text
    .replace(/\n?课程推荐评分\s*$/g, "")
    .replace(/傻逼/g, "体验一般")
    .replace(/垃圾/g, "不太行")
    .replace(/无脑冲/g, "可以冲")
    .replace(/无脑选/g, "能选")
    .replace(/\bwl\b/gi, "作业量")
    .replace(/\bworkload\b/gi, "作业量")
    .slice(0, 2000)
    .trim();

  if (text.length < 1) {
    return { ok: false, text, reasons: ["too-short"] };
  }

  return { ok: true, text, reasons };
}

export function shuffleInPlace<T>(arr: T[], rng = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 严格按比例抽样（至少 1 条，若总数 > 0） */
export function samplePercent<T>(items: T[], percent: number, rng = Math.random): T[] {
  const copy = [...items];
  shuffleInPlace(copy, rng);
  if (copy.length === 0) return [];
  const n = Math.max(1, Math.round((copy.length * percent) / 100));
  return copy.slice(0, Math.min(n, copy.length));
}
