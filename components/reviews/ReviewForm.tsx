"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ScoreInput } from "@/components/reviews/ScoreInput";
import { REVIEW_TAGS } from "@/lib/constants";
import { validateReviewForm } from "@/lib/reviews";
import { createClient } from "@/lib/supabase/client";
import type { DbReview } from "@/types/database";

type ReviewFormProps = {
  courseId: string;
  existingReview?: DbReview | null;
};

export function ReviewForm({ courseId, existingReview }: ReviewFormProps) {
  const router = useRouter();
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [difficulty, setDifficulty] = useState(existingReview?.difficulty ?? 0);
  const [grading, setGrading] = useState(existingReview?.grading ?? 0);
  const [tags, setTags] = useState<string[]>(existingReview?.tags ?? []);
  const [content, setContent] = useState(existingReview?.content ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function toggleTag(tag: string) {
    setTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag]
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const validationError = validateReviewForm({
      rating,
      difficulty,
      grading,
      tags,
      content,
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

    const payload = {
      rating,
      difficulty,
      grading,
      tags,
      content: content.trim(),
    };

    const result = existingReview
      ? await supabase
          .from("reviews")
          .update(payload)
          .eq("id", existingReview.id)
          .select("id")
          .single()
      : await supabase
          .from("reviews")
          .insert({
            ...payload,
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

    setMessage(existingReview ? "评价已更新。" : "评价已发表，将以匿名形式展示。");
    router.refresh();
  }

  async function handleDelete() {
    if (!existingReview) return;

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
    setTags([]);
    setContent("");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-purple-100 bg-white p-6 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-purple-900">
          {existingReview ? "修改我的评价" : "发表评价"}
        </h2>
        <span className="text-xs text-gray-500">匿名展示</span>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        <ScoreInput label="综合评分" value={rating} onChange={setRating} />
        <ScoreInput label="课程难度" value={difficulty} onChange={setDifficulty} />
        <ScoreInput label="给分情况" value={grading} onChange={setGrading} />
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
        </div>
      </div>

      <div className="mt-6">
        <label
          htmlFor="review-content"
          className="text-sm font-medium text-purple-900"
        >
          评价正文
        </label>
        <textarea
          id="review-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={5}
          placeholder="分享你的真实体验，至少 16 个字。请勿发布人身攻击或泄露隐私的内容。"
          className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none ring-purple-200 focus:ring-2"
        />
        <p className="mt-2 text-xs text-gray-500">
          已输入 {content.trim().length} 字
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
          {existingReview ? "保存修改" : "发表评价"}
        </button>

        {existingReview && (
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
