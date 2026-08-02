"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MAX_DISCUSSION_CONTENT_LENGTH,
  MIN_DISCUSSION_CONTENT_LENGTH,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { DbReview } from "@/types/database";

export type AuthorCourseScores = Pick<
  DbReview,
  "rating" | "difficulty" | "grading"
>;

type DiscussionSectionProps = {
  courseId: string;
  isLoggedIn: boolean;
};

export function DiscussionSection({
  courseId,
  isLoggedIn,
}: DiscussionSectionProps) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const trimmed = content.trim();
    if (trimmed.length < MIN_DISCUSSION_CONTENT_LENGTH) {
      setError(`请至少填写 ${MIN_DISCUSSION_CONTENT_LENGTH} 个字`);
      return;
    }
    if (trimmed.length > MAX_DISCUSSION_CONTENT_LENGTH) {
      setError(`内容最多 ${MAX_DISCUSSION_CONTENT_LENGTH} 个字`);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      setError("请先登录后再发帖。");
      return;
    }

    const { error: insertError } = await supabase
      .from("discussion_posts")
      .insert({
        course_id: courseId,
        user_id: user.id,
        parent_id: null,
        content: trimmed,
      });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setContent("");
    setMessage("评论已发布。");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">匿名展示</p>

      {isLoggedIn ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm"
        >
          <label className="block text-sm font-medium text-purple-900">
            发表评论
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={4}
              maxLength={MAX_DISCUSSION_CONTENT_LENGTH}
              placeholder={`例如：期末是开卷吗？作业多吗？至少 ${MIN_DISCUSSION_CONTENT_LENGTH} 个字。请勿人身攻击或泄露隐私。`}
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none ring-purple-200 focus:ring-2"
            />
          </label>
          <p className="mt-2 text-xs text-gray-500">
            已输入 {content.trim().length}/{MAX_DISCUSSION_CONTENT_LENGTH}
          </p>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          {message && <p className="mt-3 text-sm text-green-700">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-purple-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-purple-800 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            发布评论
          </button>
        </form>
      ) : (
        <div className="rounded-2xl border border-dashed border-purple-200 bg-purple-50/40 p-5 text-sm text-purple-900">
          登录后可发表评论或回复。
        </div>
      )}
    </div>
  );
}
