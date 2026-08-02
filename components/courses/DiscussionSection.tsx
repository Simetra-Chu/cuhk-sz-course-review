"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LikeButton } from "@/components/common/LikeButton";
import {
  MAX_DISCUSSION_CONTENT_LENGTH,
  MIN_DISCUSSION_CONTENT_LENGTH,
} from "@/lib/constants";
import { formatReviewDate } from "@/lib/reviews";
import { createClient } from "@/lib/supabase/client";
import type { DbDiscussionPost } from "@/types/database";

type DiscussionSectionProps = {
  courseId: string;
  isLoggedIn: boolean;
  currentUserId?: string | null;
  initialPosts: DbDiscussionPost[];
  likedPostIds: string[];
};

export function DiscussionSection({
  courseId,
  isLoggedIn,
  currentUserId,
  initialPosts,
  likedPostIds,
}: DiscussionSectionProps) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const likedSet = new Set(likedPostIds);

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
        content: trimmed,
      });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setContent("");
    setMessage("已发布到讨论区。");
    router.refresh();
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("确定删除这条讨论吗？");
    if (!confirmed) return;

    setDeletingId(id);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("discussion_posts")
      .delete()
      .eq("id", id);

    setDeletingId(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-600">
          把对这门课的疑问、想了解的考点 / 作业 / 给分等信息发在这里，方便同学交流。匿名展示。
        </p>
      </div>

      {isLoggedIn ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm"
        >
          <label className="block text-sm font-medium text-purple-900">
            发起讨论
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
            发布
          </button>
        </form>
      ) : (
        <div className="rounded-2xl border border-dashed border-purple-200 bg-purple-50/40 p-5 text-sm text-purple-900">
          登录后可在讨论区提问或分享想了解的内容。
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-purple-900">
          全部讨论 ({initialPosts.length})
        </h2>

        {initialPosts.length === 0 ? (
          <p className="rounded-2xl border border-purple-100 bg-white p-5 text-sm text-gray-600">
            还没有讨论，来提第一个问题吧。
          </p>
        ) : (
          initialPosts.map((post) => {
            const isOwn = currentUserId === post.user_id;
            return (
              <article
                key={post.id}
                className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs text-gray-500">
                    匿名同学 ·{" "}
                    <time dateTime={post.created_at}>
                      {formatReviewDate(post.created_at)}
                    </time>
                    {isOwn && (
                      <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-800">
                        我的帖子
                      </span>
                    )}
                  </p>
                  {isOwn && (
                    <button
                      type="button"
                      onClick={() => handleDelete(post.id)}
                      disabled={deletingId === post.id}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                    >
                      {deletingId === post.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      删除
                    </button>
                  )}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-800">
                  {post.content}
                </p>
                <div className="mt-4">
                  <LikeButton
                    targetType="discussion_post"
                    targetId={post.id}
                    initialCount={post.like_count ?? 0}
                    initialLiked={likedSet.has(post.id)}
                    isLoggedIn={isLoggedIn}
                  />
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
