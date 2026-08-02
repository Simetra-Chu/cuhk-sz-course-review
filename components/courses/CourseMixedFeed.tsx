"use client";

import { Loader2, MessageCircle, Trash2, X } from "lucide-react";
import {
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { AuthorCourseScores } from "@/components/courses/DiscussionSection";
import { LikeButton } from "@/components/common/LikeButton";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import {
  MAX_DISCUSSION_CONTENT_LENGTH,
  MIN_DISCUSSION_CONTENT_LENGTH,
} from "@/lib/constants";
import { formatReviewDate, formatScoreLabel } from "@/lib/reviews";
import { createClient } from "@/lib/supabase/client";
import type { DbDiscussionPost, DbReview } from "@/types/database";

type FeedItem =
  | { kind: "review"; createdAt: string; review: DbReview }
  | { kind: "comment"; createdAt: string; post: DbDiscussionPost };

type CourseMixedFeedProps = {
  courseId: string;
  isLoggedIn: boolean;
  currentUserId?: string | null;
  reviews: DbReview[];
  posts: DbDiscussionPost[];
  likedReviewIds: string[];
  likedPostIds: string[];
  authorScoresByUserId?: Record<string, AuthorCourseScores>;
  canReport: boolean;
  emptyAction?: ReactNode;
};

export function CourseMixedFeed({
  courseId,
  isLoggedIn,
  currentUserId,
  reviews,
  posts,
  likedReviewIds,
  likedPostIds,
  authorScoresByUserId = {},
  canReport,
  emptyAction,
}: CourseMixedFeedProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replyLoading, setReplyLoading] = useState(false);
  const likedReviewSet = new Set(likedReviewIds);
  const likedPostSet = new Set(likedPostIds);

  const { roots, repliesByParent, items } = useMemo(() => {
    const rootPosts = posts
      .filter((post) => !post.parent_id)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    const map = new Map<string, DbDiscussionPost[]>();
    for (const post of posts) {
      if (!post.parent_id) continue;
      const list = map.get(post.parent_id) ?? [];
      list.push(post);
      map.set(post.parent_id, list);
    }
    Array.from(map.values()).forEach((list) => {
      list.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });

    const feed: FeedItem[] = [
      ...reviews.map((review) => ({
        kind: "review" as const,
        createdAt: review.created_at,
        review,
      })),
      ...rootPosts.map((post) => ({
        kind: "comment" as const,
        createdAt: post.created_at,
        post,
      })),
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return { roots: rootPosts, repliesByParent: map, items: feed };
  }, [posts, reviews]);

  async function createReply(parentId: string, text: string) {
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
    if (!user) return "请先登录后再回复。";

    const { error: insertError } = await supabase
      .from("discussion_posts")
      .insert({
        course_id: courseId,
        user_id: user.id,
        parent_id: parentId,
        content: trimmed,
      });

    return insertError?.message ?? null;
  }

  async function handleReplySubmit(event: FormEvent, parentId: string) {
    event.preventDefault();
    setReplyError(null);
    setReplyLoading(true);
    const resultError = await createReply(parentId, replyContent);
    setReplyLoading(false);
    if (resultError) {
      setReplyError(resultError);
      return;
    }
    setReplyContent("");
    setReplyingTo(null);
    router.refresh();
  }

  async function handleDelete(id: string, isReply: boolean) {
    const confirmed = window.confirm(
      isReply
        ? "确定删除这条回复吗？"
        : "确定删除这条评论吗？其下回复也会一并删除。"
    );
    if (!confirmed) return;

    setDeletingId(id);
    setError(null);
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
          isReply ? "border-purple-50 bg-purple-50/30" : "border-purple-100"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">
              <span className="mr-1.5 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800">
                评论
              </span>
              匿名同学 ·{" "}
              <time dateTime={post.created_at}>
                {formatReviewDate(post.created_at)}
              </time>
              {isOwn && (
                <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-800">
                  {isReply ? "我的回复" : "我的评论"}
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
            initialLiked={likedPostSet.has(post.id)}
            isLoggedIn={isLoggedIn}
          />
          {!isReply && (
            <button
              type="button"
              onClick={() => {
                if (!isLoggedIn) {
                  setError("登录后可回复评论");
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

  const total = reviews.length + roots.length;

  return (
    <div id="course-feed" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold text-purple-950">全部</h2>
        <p className="text-sm text-gray-500">
          {reviews.length} 条评价 · {roots.length} 条评论
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {total === 0 ? (
        <div className="rounded-2xl border border-purple-100 bg-white p-6">
          <p className="text-sm text-gray-600">还没有评价或评论。</p>
          {emptyAction && <div className="mt-4">{emptyAction}</div>}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) =>
            item.kind === "review" ? (
              <div key={`review-${item.review.id}`}>
                <p className="mb-2 text-xs text-gray-500">
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                    评价
                  </span>
                </p>
                <ReviewCard
                  review={item.review}
                  canReport={canReport}
                  isOwn={currentUserId === item.review.user_id}
                  isLoggedIn={isLoggedIn}
                  initialLiked={likedReviewSet.has(item.review.id)}
                />
              </div>
            ) : (
              <div key={`comment-${item.post.id}`}>
                {renderPost(item.post)}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
