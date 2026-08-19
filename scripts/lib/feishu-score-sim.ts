/**
 * 基于飞书评论文本启发式生成评分（综合 / 难度 / 给分 / 签到频率）。
 * 先推断难度与给分，再让综合分依赖二者（目标相关 ρ≈0.35）；
 * 签到频率独立推断，不进入综合联动。
 * 若有飞书推荐分，作为综合分的软锚点与依赖结果混合。
 */
import {
  OVERALL_SCORE_RHO,
  suggestOverallFromDimensions,
} from "../../lib/reviews";

export type SimulatedScores = {
  rating: number;
  difficulty: number;
  grading: number;
  attendance: number;
};

function clampScore(n: number): number {
  return Math.min(5, Math.max(1, Math.round(n)));
}

function hitCount(text: string, patterns: RegExp[]): number {
  let n = 0;
  for (const p of patterns) {
    if (p.test(text)) n += 1;
  }
  return n;
}

const HARD = [
  /很难/,
  /太难/,
  /难度大/,
  /作业量大/,
  /作业多/,
  /压力大/,
  /节奏快/,
  /赶/,
  /challenging/i,
  /hard/i,
];
const EASY = [
  /简单/,
  /不难/,
  /水课/,
  /很水/,
  /作业少/,
  /作业量小/,
  /作业量不大/,
  /轻松/,
  /好过/,
  /easy/i,
];
const GENEROUS = [
  /给分好/,
  /给分高/,
  /给分很/,
  /好拿/,
  /容易拿/,
  /gpa.*高/i,
  /不压分/,
  /慷慨/,
  /分数高/,
];
const STRICT = [
  /压分/,
  /给分严/,
  /给分低/,
  /难拿/,
  /卡分/,
  /严格/,
  /分数低/,
  /不好拿/,
];
const ATTEND_OFTEN = [
  /每节签/,
  /每节点/,
  /总是签/,
  /经常签/,
  /签到频繁/,
  /点名频繁/,
  /点名多/,
  /频繁点名/,
  /几乎每节/,
];
const ATTEND_RARE = [
  /不签到/,
  /几乎不签/,
  /很少签/,
  /签到少/,
  /从不点名/,
  /不点名/,
  /无签到/,
  /很少点名/,
];
const ATTEND_SOMETIMES = [/偶尔签/, /有时签/, /偶尔点名/, /有时点名/];

/**
 * @param text 评价正文
 * @param recommendScore 飞书推荐分 1–5（可空）
 * @param jitter 0–1 随机数，用于同课多份离散分
 * @param attendanceHint 可选的飞书「签到频率」原文，优先用于推断
 */
export function simulateScoresFromText(
  text: string,
  recommendScore: number | null | undefined,
  jitter = 0.5,
  attendanceHint?: string | null
): SimulatedScores {
  const raw = (text ?? "").trim();
  const attendSrc = `${attendanceHint ?? ""} ${raw}`.trim();
  const hard = hitCount(raw, HARD);
  const easy = hitCount(raw, EASY);
  const generous = hitCount(raw, GENEROUS);
  const strict = hitCount(raw, STRICT);
  const often = hitCount(attendSrc, ATTEND_OFTEN);
  const rare = hitCount(attendSrc, ATTEND_RARE);
  const sometimes = hitCount(attendSrc, ATTEND_SOMETIMES);

  const difficulty = clampScore(
    3 + (hard - easy) * 0.7 + (jitter - 0.5) * 0.45
  );
  const grading = clampScore(
    3 + (generous - strict) * 0.75 + (jitter - 0.5) * 0.45
  );

  let attendance = 3 + (often - rare) * 0.9 + sometimes * 0.15;
  attendance += (jitter - 0.5) * 0.4;
  attendance = clampScore(attendance);

  let rating =
    suggestOverallFromDimensions(difficulty, grading, jitter) ?? 3;

  if (recommendScore != null && Number.isFinite(recommendScore)) {
    const anchor = Math.min(5, Math.max(1, Number(recommendScore)));
    rating = clampScore(0.62 * rating + 0.38 * anchor);
  }

  return { rating, difficulty, grading, attendance };
}

export { OVERALL_SCORE_RHO };

/**
 * 按飞书全量活跃度决定：离散打分份数、求评价权重份数。
 */
export function activityWeights(feishuCount: number): {
  scoreCopies: number;
  requestCopies: number;
} {
  const n = Math.max(0, Math.floor(feishuCount));
  const scoreCopies = Math.min(12, Math.max(1, 1 + Math.floor(n / 2)));
  const requestCopies = Math.min(15, Math.max(0, Math.floor(n / 2)));
  return { scoreCopies, requestCopies };
}
