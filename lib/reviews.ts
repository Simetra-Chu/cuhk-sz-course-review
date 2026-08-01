import {
  MAX_CUSTOM_TAG_LENGTH,
  MAX_REVIEW_TAGS,
  MIN_CUSTOM_TAG_LENGTH,
  MIN_REVIEW_CONTENT_LENGTH,
  REVIEW_TAGS,
} from "@/lib/constants";

export type ReviewFormValues = {
  rating: number;
  difficulty: number;
  grading: number;
  tags: string[];
  content: string;
};

export function normalizeReviewTags(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

export function isPresetReviewTag(tag: string) {
  return REVIEW_TAGS.some((preset) => preset === tag);
}

export function validateReviewForm(values: ReviewFormValues) {
  if (values.rating < 1 || values.rating > 5) {
    return "请选择综合评分（1-5 星）";
  }

  if (values.difficulty < 1 || values.difficulty > 5) {
    return "请选择难度评分（1-5 星）";
  }

  if (values.grading < 1 || values.grading > 5) {
    return "请选择给分评分（1-5 星）";
  }

  const tags = normalizeReviewTags(values.tags);
  if (tags.length > MAX_REVIEW_TAGS) {
    return `每条评价最多选择 ${MAX_REVIEW_TAGS} 个标签`;
  }
  if (tags.length !== values.tags.length) {
    return "标签不能重复或包含空白内容";
  }

  const customTags = tags.filter((tag) => !isPresetReviewTag(tag));
  if (customTags.length > 1) {
    return "每条评价最多添加 1 个自定义标签";
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

  const content = values.content.trim();
  if (content.length <= MIN_REVIEW_CONTENT_LENGTH - 1) {
    return `评价正文至少 ${MIN_REVIEW_CONTENT_LENGTH} 个字`;
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
