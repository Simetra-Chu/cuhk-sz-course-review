"use client";

import { Loader2, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ScoreInput } from "@/components/reviews/ScoreInput";
import {
  MAX_CUSTOM_REVIEW_TAGS,
  MAX_CUSTOM_TAG_LENGTH,
  MAX_REVIEW_TAGS,
  MIN_CUSTOM_TAG_LENGTH,
  IMPORT_AUTHOR_USER_ID,
  REVIEW_TAGS,
} from "@/lib/constants";
import {
  isPresetReviewTag,
  normalizeOptionalScore,
  normalizeReviewTags,
  suggestOverallFromDimensions,
  validateReviewForm,
} from "@/lib/reviews";
import { createClient } from "@/lib/supabase/client";
import type { DbReview } from "@/types/database";

type ReviewFormProps = {
  courseId: string;
  existingReview?: DbReview | null;
  /** 导入账号可同课多次打分，表单始终走「新增」 */
  allowMultipleScores?: boolean;
};

export function ReviewForm({
  courseId,
  existingReview,
  allowMultipleScores = false,
}: ReviewFormProps) {
  const router = useRouter();
  const editing = Boolean(existingReview) && !allowMultipleScores;
  const [rating, setRating] = useState(editing ? existingReview?.rating ?? 0 : 0);
  const [difficulty, setDifficulty] = useState(
    editing ? existingReview?.difficulty ?? 0 : 0
  );
  const [grading, setGrading] = useState(
    editing ? existingReview?.grading ?? 0 : 0
  );
  const [attendance, setAttendance] = useState(
    editing ? existingReview?.attendance ?? 0 : 0
  );
  const [tags, setTags] = useState<string[]>(
    editing ? existingReview?.tags ?? [] : []
  );
  /** 用户是否手动改过综合分；未改时随难度/给分联动 */
  const [ratingManual, setRatingManual] = useState(false);

  function applyDimensionChange(
    nextDifficulty: number,
    nextGrading: number,
    manualOverall?: number
  ) {
    setDifficulty(nextDifficulty);
    setGrading(nextGrading);
    if (manualOverall != null) {
      setRating(manualOverall);
      setRatingManual(true);
      return;
    }
    if (ratingManual) return;
    const suggested = suggestOverallFromDimensions(
      nextDifficulty >= 1 ? nextDifficulty : null,
      nextGrading >= 1 ? nextGrading : null
    );
    if (suggested != null) setRating(suggested);
  }
  const [customTagDraft, setCustomTagDraft] = useState("");
  const [showCustomTagInput, setShowCustomTagInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const customTags = tags.filter((tag) => !isPresetReviewTag(tag));
  const canAddCustomTag = customTags.length < MAX_CUSTOM_REVIEW_TAGS;

  function toggleTag(tag: string) {
    setTags((current) => {
      if (current.includes(tag)) {
        return current.filter((item) => item !== tag);
      }
      if (current.length >= MAX_REVIEW_TAGS) {
        setError(`每条评价最多选择 ${MAX_REVIEW_TAGS} 个标签`);
        return current;
      }
      setError(null);
      return [...current, tag];
    });
  }

  function addCustomTag() {
    const tag = customTagDraft.trim();
    if (
      tag.length < MIN_CUSTOM_TAG_LENGTH ||
      tag.length > MAX_CUSTOM_TAG_LENGTH
    ) {
      setError(
        `自定义标签需为 ${MIN_CUSTOM_TAG_LENGTH}–${MAX_CUSTOM_TAG_LENGTH} 个字`
      );
      return;
    }
    if (isPresetReviewTag(tag)) {
      setError("该标签已在预设选项中，请直接选择");
      return;
    }
    if (tags.includes(tag)) {
      setError("该标签已添加");
      return;
    }

    const existingCustomCount = tags.filter(
      (item) => !isPresetReviewTag(item)
    ).length;
    if (existingCustomCount >= MAX_CUSTOM_REVIEW_TAGS) {
      setError(`每条评价最多添加 ${MAX_CUSTOM_REVIEW_TAGS} 个自定义标签`);
      return;
    }

    const nextTags = [...tags, tag];
    if (normalizeReviewTags(nextTags).length > MAX_REVIEW_TAGS) {
      setError(`每条评价最多选择 ${MAX_REVIEW_TAGS} 个标签`);
      return;
    }

    setTags(normalizeReviewTags(nextTags));
    setCustomTagDraft("");
    setShowCustomTagInput(false);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const scoredPayload = {
      rating: normalizeOptionalScore(rating),
      difficulty: normalizeOptionalScore(difficulty),
      grading: normalizeOptionalScore(grading),
      attendance: normalizeOptionalScore(attendance),
    };

    const validationError = validateReviewForm({
      ...scoredPayload,
      tags,
    });

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      setError("请先登录后再发表评价。");
      return;
    }

    // 评价区只负责打分/标签；文字留言请到下方评论区
    const scoreAndTags = {
      ...scoredPayload,
      tags: normalizeReviewTags(tags),
    };

    const result = editing
      ? await supabase
          .from("reviews")
          .update(scoreAndTags)
          .eq("id", existingReview!.id)
          .select("id")
          .single()
      : await supabase
          .from("reviews")
          .insert({
            ...scoreAndTags,
            content: "",
            course_id: courseId,
            user_id: user.id,
          })
          .select("id")
          .single();

    setLoading(false);

    if (result.error) {
      if (result.error.code === "23505") {
        setError("你已经评价过这门课，请直接修改原评价。");
        return;
      }
      setError(result.error.message);
      return;
    }

    setMessage(editing ? "评价已更新。" : "评价已发表，将以匿名形式展示。");
    if (allowMultipleScores || user.id === IMPORT_AUTHOR_USER_ID) {
      setRating(0);
      setDifficulty(0);
      setGrading(0);
      setAttendance(0);
      setTags([]);
      setRatingManual(false);
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!editing || !existingReview) return;

    const confirmed = window.confirm(
      "确定删除这条评价吗？删除后无法恢复，课程评分和评价数也会自动更新。"
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("reviews")
      .delete()
      .eq("id", existingReview.id);

    setDeleting(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setRating(0);
    setDifficulty(0);
    setGrading(0);
    setAttendance(0);
    setTags([]);
    setCustomTagDraft("");
    setShowCustomTagInput(false);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-purple-100 bg-white p-6 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-purple-900">
          {editing ? "修改我的评价" : "发表评价"}
        </h2>
        <span className="text-xs text-gray-500">匿名展示</span>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <ScoreInput
          label="课程难度"
          value={difficulty}
          onChange={(value) => applyDimensionChange(value, grading)}
          hint="1 轻松 → 5 很难"
        />
        <ScoreInput
          label="给分情况"
          value={grading}
          onChange={(value) => applyDimensionChange(difficulty, value)}
          hint="1 严格 → 5 慷慨"
        />
        <ScoreInput
          label="签到频率"
          value={attendance}
          onChange={setAttendance}
          hint="1 很少签到 → 5 很频繁"
        />
        <ScoreInput
          label="综合评分"
          value={rating}
          onChange={(value) => {
            setRating(value);
            setRatingManual(true);
          }}
          hint="默认随难度/给分联动（相关约 0.35），可手动覆盖"
        />
      </div>

      <div className="mt-6">
        <p className="text-sm font-medium text-purple-900">标签（可选）</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {REVIEW_TAGS.map((tag) => {
            const active = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  active
                    ? "border-purple-700 bg-purple-700 text-white"
                    : "border-purple-200 bg-white text-purple-900 hover:border-purple-400 hover:bg-purple-50"
                }`}
              >
                {tag}
              </button>
            );
          })}
          {customTags.map((customTag) => (
            <button
              key={customTag}
              type="button"
              onClick={() =>
                setTags((current) =>
                  current.filter((item) => item !== customTag)
                )
              }
              className="inline-flex items-center gap-1 rounded-full border border-purple-700 bg-purple-700 px-3 py-1.5 text-sm text-white"
              title="删除自定义标签"
            >
              {customTag}
              <X className="h-3.5 w-3.5" />
            </button>
          ))}
          {!showCustomTagInput && canAddCustomTag && (
            <button
              type="button"
              onClick={() => {
                setCustomTagDraft("");
                setShowCustomTagInput(true);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-purple-300 px-3 py-1.5 text-sm text-purple-700 transition hover:bg-purple-50"
            >
              <Plus className="h-3.5 w-3.5" />
              自定义
            </button>
          )}
        </div>
        {showCustomTagInput && (
          <div className="mt-3 flex max-w-sm items-center gap-2">
            <input
              type="text"
              value={customTagDraft}
              maxLength={MAX_CUSTOM_TAG_LENGTH}
              onChange={(event) => setCustomTagDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomTag();
                }
              }}
              placeholder={`${MIN_CUSTOM_TAG_LENGTH}–${MAX_CUSTOM_TAG_LENGTH} 个字`}
              aria-label="自定义评价标签"
              className="min-w-0 flex-1 rounded-lg border border-purple-200 px-3 py-2 text-sm outline-none ring-purple-200 focus:ring-2"
            />
            <button
              type="button"
              onClick={addCustomTag}
              className="rounded-lg bg-purple-700 px-3 py-2 text-sm font-medium text-white hover:bg-purple-800"
            >
              添加
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCustomTagInput(false);
                setCustomTagDraft("");
              }}
              className="rounded-lg px-2 py-2 text-sm text-gray-500 hover:bg-gray-100"
            >
              取消
            </button>
          </div>
        )}
        <p className="mt-2 text-xs text-gray-500">
          已选 {tags.length}/{MAX_REVIEW_TAGS}，最多 {MAX_CUSTOM_REVIEW_TAGS}{" "}
          个自定义标签
        </p>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {message && (
        <p className="mt-4 text-sm text-green-700">{message}</p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={loading || deleting}
          className="inline-flex items-center gap-2 rounded-xl bg-purple-700 px-5 py-3 text-sm font-medium text-white transition hover:bg-purple-800 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {editing ? "保存修改" : "发表评价"}
        </button>

        {editing && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading || deleting}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-5 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            删除评价
          </button>
        )}
      </div>
    </form>
  );
}
