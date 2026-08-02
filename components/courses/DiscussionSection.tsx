"use client";

import { Loader2, MessageCircle, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LikeButton } from "@/components/common/LikeButton";
import {
  MAX_DISCUSSION_CONTENT_LENGTH,
  MIN_DISCUSSION_CONTENT_LENGTH,
} from "@/lib/constants";
import { formatReviewDate, formatScoreLabel } from "@/lib/reviews";
import { createClient } from "@/lib/supabase/client";
import type { DbDiscussionPost, DbReview } from "@/types/database";

export type AuthorCourseScores = Pick<
  DbReview,
  "rating" | "difficulty" | "grading"
>;

type DiscussionSectionProps = {
  courseId: string;
  isLoggedIn: boolean;
  currentUserId?: string | null;
  initialPosts: DbDiscussionPost[];
  likedPostIds: string[];
  /** 该课上各用户评价中的评分，用于在讨论/回复旁展示 */
  authorScoresByUserId?: Record<string, AuthorCourseScores>;
};

export function DiscussionSection({
  courseId,
  isLoggedIn,
  currentUserId,
  initialPosts,
  likedPostIds,
  authorScoresByUserId = {},
}: DiscussionSectionProps) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replyLoading, setReplyLoading] = useState(false);
  const likedSet = new Set(likedPostIds);

  const { roots, repliesByParent } = useMemo(() => {
    const rootPosts = initialPosts
      .filter((post) => !post.parent_id)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    const map = new Map<string, DbDiscussionPost[]>();
    for (const post of initialPosts) {
      if (!post.parent_id) continue;
      const list = map.get(post.parent_id) ?? [];
      list.push(post);
      map.set(post.parent_id, list);
    }
    Array.from(map.values()).forEach((list) => {
      list.sort(
        (a: DbDiscussionPost, b: DbDiscussionPost) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
    return { roots: rootPosts, repliesByParent: map };
  }, [initialPosts]);

  async function createPost(text: string, parentId: string | null) {
    const trimmed = text.trim();
    if (trimmed.length < MIN_DISCUSSION_CONTENT_LENGTH) {
      return `请至少填写 ${MIN_DISCUSSION_CONTENT_LENGTH} 个字`;
    }
    if (trimmed.length > MAX_DISCUSSION_CONTENT_LENGTH) {
      return `内容最多 ${MAX_DISCUSSION_CONTENT_LENGTH} 个字`;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return "请先登录后再发帖。";
    }

    const { error: insertError } = await supabase
      .from("discussion_posts")
      .insert({
        course_id: courseId,
        user_id: user.id,
        parent_id: parentId,
        content: trimmed,
      });

    if (insertError) {
      return insertError.message;
    }

    router.refresh();
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const resultError = await createPost(content, null);
    setLoading(false);
    if (resultError) {
      setError(resultError);
      return;
    }
    setContent("");
    setMessage("评论已发布。");
  }

  async function handleReplySubmit(event: React.FormEvent, parentId: string) {
    event.preventDefault();
    setReplyError(null);
    setReplyLoading(true);
    const resultError = await createPost(replyContent, parentId);
    setReplyLoading(false);
    if (resultError) {
      setReplyError(resultError);
      return;
    }
    setReplyContent("");
    setReplyingTo(null);
  }

  async function handleDelete(id: string, isReply: boolean) {
    const confirmed = window.confirm(
      isReply
        ? "确定删除这条回复吗？"
        : "确定删除这条讨论吗？其下回复也会一并删除。"
    );
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

  function renderPost(
    post: DbDiscussionPost,
    options: { isReply?: boolean } = {}
  ) {
    const isOwn = currentUserId === post.user_id;
    const isReply = Boolean(options.isReply);
    const replies = repliesByParent.get(post.id) ?? [];
    const scores = authorScoresByUserId[post.user_id];

    return (
      <article
        key={post.id}
        className={`rounded-2xl border bg-white p-5 shadow-sm ${
          isReply
            ? "border-purple-50 bg-purple-50/30"
            : "border-purple-100"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">
              匿名同学 ·{" "}
              <time dateTime={post.created_at}>
                {formatReviewDate(post.created_at)}
              </time>
              {isOwn && (
                <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-800">
                  {isReply ? "我的回复" : "我的帖子"}
                </span>
              )}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-purple-800">
                综合 {formatScoreLabel(scores?.rating)}
              </span>
              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-purple-800">
                难度 {formatScoreLabel(scores?.difficulty)}
              </span>
              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-purple-800">
                给分 {formatScoreLabel(scores?.grading)}
              </span>
            </div>
          </div>
          {isOwn && (
            <button
              type="button"
              onClick={() => handleDelete(post.id, isReply)}
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

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <LikeButton
            targetType="discussion_post"
            targetId={post.id}
            initialCount={post.like_count ?? 0}
            initialLiked={likedSet.has(post.id)}
            isLoggedIn={isLoggedIn}
          />
          {!isReply && (
            <button
              type="button"
              onClick={() => {
                if (!isLoggedIn) {
                  setError("登录后可回复讨论");
                  return;
                }
                setReplyingTo((current) =>
                  current === post.id ? null : post.id
                );
                setReplyContent("");
                setReplyError(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-purple-100 px-3 py-1.5 text-xs font-medium text-purple-800 transition hover:bg-purple-50"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              回复{replies.length > 0 ? ` (${replies.length})` : ""}
            </button>
          )}
        </div>

        {!isReply && replyingTo === post.id && (
          <form
            onSubmit={(event) => handleReplySubmit(event, post.id)}
            className="mt-4 rounded-xl border border-purple-100 bg-white p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-purple-900">写回复</p>
              <button
                type="button"
                onClick={() => {
                  setReplyingTo(null);
                  setReplyContent("");
                  setReplyError(null);
                }}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
                aria-label="取消回复"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={replyContent}
              onChange={(event) => setReplyContent(event.target.value)}
              rows={3}
              maxLength={MAX_DISCUSSION_CONTENT_LENGTH}
              placeholder={`回复至少 ${MIN_DISCUSSION_CONTENT_LENGTH} 个字`}
              className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none ring-purple-200 focus:ring-2"
            />
            {replyError && (
              <p className="mt-2 text-sm text-red-600">{replyError}</p>
            )}
            <button
              type="submit"
              disabled={replyLoading}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-purple-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-purple-800 disabled:opacity-60"
            >
              {replyLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              发布回复
            </button>
          </form>
        )}

        {!isReply && replies.length > 0 && (
          <div className="mt-4 space-y-3 border-l-2 border-purple-100 pl-4">
            {replies.map((reply) => renderPost(reply, { isReply: true }))}
          </div>
        )}
      </article>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-600">匿名展示</p>
      </div>

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

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-purple-900">
          全部评论 ({roots.length})
        </h3>

        {roots.length === 0 ? (
          <p className="rounded-2xl border border-purple-100 bg-white p-5 text-sm text-gray-600">
            还没有讨论，来提第一个问题吧。
          </p>
        ) : (
          roots.map((post) => renderPost(post))
        )}
      </div>
    </div>
  );
}
