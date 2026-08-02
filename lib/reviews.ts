import {
  MAX_CUSTOM_REVIEW_TAGS,
  MAX_CUSTOM_TAG_LENGTH,
  MAX_REVIEW_TAGS,
  MIN_CUSTOM_TAG_LENGTH,
  REVIEW_TAGS,
} from "@/lib/constants";

export type ReviewFormValues = {
  rating: number | null;
  difficulty: number | null;
  grading: number | null;
  tags: string[];
};

export type ReviewScoreFields = {
  rating: number | null;
  difficulty: number | null;
  grading: number | null;
};

export function normalizeReviewTags(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

export function isPresetReviewTag(tag: string) {
  return REVIEW_TAGS.some((preset) => preset === tag);
}

function isOptionalScore(value: number | null) {
  return value === null || (value >= 1 && value <= 5);
}

export function formatScoreLabel(value: number | null | undefined) {
  if (value == null || value < 1) return "未评分";
  return `${value}/5`;
}

export function hasAnyScore(scores: ReviewScoreFields) {
  return (
    (scores.rating != null && scores.rating >= 1) ||
    (scores.difficulty != null && scores.difficulty >= 1) ||
    (scores.grading != null && scores.grading >= 1)
  );
}

export function normalizeOptionalScore(value: number) {
  return value >= 1 && value <= 5 ? value : null;
}

export function validateReviewForm(values: ReviewFormValues) {
  if (!isOptionalScore(values.rating)) {
    return "综合评分需为 1-5 星，或不评分";
  }

  if (!isOptionalScore(values.difficulty)) {
    return "难度评分需为 1-5 星，或不评分";
  }

  if (!isOptionalScore(values.grading)) {
    return "给分评分需为 1-5 星，或不评分";
  }

  if (!hasAnyScore(values)) {
    return "请至少选择一项评分（综合 / 难度 / 给分）";
  }

  const tags = normalizeReviewTags(values.tags);
  if (tags.length > MAX_REVIEW_TAGS) {
    return `每条评价最多选择 ${MAX_REVIEW_TAGS} 个标签`;
  }
  if (tags.length !== values.tags.length) {
    return "标签不能重复或包含空白内容";
  }

  const customTags = tags.filter((tag) => !isPresetReviewTag(tag));
  if (customTags.length > MAX_CUSTOM_REVIEW_TAGS) {
    return `每条评价最多添加 ${MAX_CUSTOM_REVIEW_TAGS} 个自定义标签`;
  }
  if (
    customTags.some(
      (tag) =>
        tag.length < MIN_CUSTOM_TAG_LENGTH ||
        tag.length > MAX_CUSTOM_TAG_LENGTH
    )
  ) {
    return `自定义标签需为 ${MIN_CUSTOM_TAG_LENGTH}–${MAX_CUSTOM_TAG_LENGTH} 个字`;
  }

  return null;
}

export function formatReviewDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
