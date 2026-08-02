import Link from "next/link";
import { Clock, Star } from "lucide-react";
import type { ReviewWithCourse } from "@/lib/review-queries";
import { formatReviewDate, formatScoreLabel } from "@/lib/reviews";

type RecentReviewsFeedProps = {
  reviews: ReviewWithCourse[];
};

export function RecentReviewsFeed({ reviews }: RecentReviewsFeedProps) {
  return (
    <section className="mt-10">
      <div className="flex items-center gap-2 text-purple-900">
        <Clock className="h-5 w-5" />
        <h2 className="text-lg font-semibold">最新评价</h2>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        仅展示公开可见的匿名评价
      </p>

      {reviews.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-purple-100 bg-white p-6 text-sm text-gray-600 shadow-sm">
          暂无公开评价。
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {reviews.map((review) => (
            <article
              key={review.id}
              className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/course/${review.course.code}`}
                  className="font-mono text-sm font-semibold text-purple-800 hover:underline"
                >
                  {review.course.code}
                </Link>
                <time
                  dateTime={review.created_at}
                  className="text-xs text-gray-500"
                >
                  {formatReviewDate(review.created_at)}
                </time>
              </div>
              <Link
                href={`/course/${review.course.code}`}
                className="mt-1 block text-sm font-medium text-purple-950 hover:text-purple-700"
              >
                {review.course.name_cn}
              </Link>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  综合 {formatScoreLabel(review.rating)}
                </span>
                <span>难度 {formatScoreLabel(review.difficulty)}</span>
                <span>给分 {formatScoreLabel(review.grading)}</span>
              </div>

              {review.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {review.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {review.content.trim() ? (
                <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                  {review.content}
                </p>
              ) : null}
              <Link
                href={`/course/${review.course.code}`}
                className="mt-3 inline-flex text-xs font-medium text-purple-700 hover:underline"
              >
                查看课程与全部评价
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
