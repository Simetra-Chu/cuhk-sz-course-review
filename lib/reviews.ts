import { MIN_REVIEW_CONTENT_LENGTH } from "@/lib/constants";

export type ReviewFormValues = {
  rating: number;
  difficulty: number;
  grading: number;
  tags: string[];
  content: string;
};

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
