/**
 * 从课程先修文本统计「被多少课当作先修」→ 基础课权重
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const CODE_RE = /[A-Z]{2,4}\s?\d{3,4}[A-Z]?/gi;

export type FoundationInfo = {
  code: string;
  prereq_for_count: number;
  is_foundation: boolean;
  weight: number;
};

function normalizeCode(raw: string) {
  return raw.replace(/\s+/g, "").toUpperCase();
}

function extractCodes(text: string | null | undefined): string[] {
  if (!text) return [];
  const found = text.match(CODE_RE) ?? [];
  return found.map(normalizeCode);
}

/**
 * 被引用次数 >= threshold 视为基础课；基础课权重 = baseWeight
 */
export async function loadFoundationWeights(opts?: {
  threshold?: number;
  foundationWeight?: number;
  normalWeight?: number;
}): Promise<{
  byCode: Map<string, FoundationInfo>;
  foundationCodes: string[];
  threshold: number;
}> {
  const threshold = opts?.threshold ?? 8;
  const foundationWeight = opts?.foundationWeight ?? 3;
  const normalWeight = opts?.normalWeight ?? 1;

  const courses = JSON.parse(
    await readFile(path.resolve(process.cwd(), "data/courses.json"), "utf8")
  ) as Array<{
    code: string;
    prerequisite?: string | null;
    corequisite?: string | null;
    exclusion?: string | null;
  }>;

  const counts = new Map<string, number>();
  for (const c of courses) {
    const refs = [
      ...extractCodes(c.prerequisite),
      ...extractCodes(c.corequisite),
      // exclusion 不算「先修依赖」，跳过
    ];
    for (const code of refs) {
      if (code === normalizeCode(c.code)) continue;
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }

  const catalog = new Set(courses.map((c) => normalizeCode(c.code)));
  const byCode = new Map<string, FoundationInfo>();
  const foundationCodes: string[] = [];

  for (const code of catalog) {
    const n = counts.get(code) ?? 0;
    const is_foundation = n >= threshold;
    if (is_foundation) foundationCodes.push(code);
    byCode.set(code, {
      code,
      prereq_for_count: n,
      is_foundation,
      weight: is_foundation ? foundationWeight : normalWeight,
    });
  }

  foundationCodes.sort(
    (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)
  );

  return { byCode, foundationCodes, threshold };
}

/** 加权不放回抽样，目标约 percent% 条 */
export function weightedSample<T>(
  items: T[],
  weightOf: (item: T) => number,
  percent: number,
  rng: () => number
): T[] {
  if (items.length === 0) return [];
  const target = Math.max(1, Math.round((items.length * percent) / 100));
  const pool = items.map((item, index) => ({
    item,
    index,
    w: Math.max(0.0001, weightOf(item)),
  }));

  const picked: T[] = [];
  const used = new Set<number>();

  while (picked.length < Math.min(target, pool.length)) {
    let total = 0;
    for (const p of pool) {
      if (!used.has(p.index)) total += p.w;
    }
    if (total <= 0) break;
    let r = rng() * total;
    let chosen = -1;
    for (const p of pool) {
      if (used.has(p.index)) continue;
      r -= p.w;
      if (r <= 0) {
        chosen = p.index;
        break;
      }
    }
    if (chosen < 0) {
      const rest = pool.find((p) => !used.has(p.index));
      if (!rest) break;
      chosen = rest.index;
    }
    used.add(chosen);
    picked.push(pool[chosen].item);
  }

  return picked;
}
