import { Star } from "lucide-react";
import { ReportButton } from "@/components/reviews/ReportButton";
import { formatReviewDate } from "@/lib/reviews";
import type { DbReview } from "@/types/database";

type ReviewCardProps = {
  review: DbReview;
  canReport: boolean;
  isOwn: boolean;
};

function ScoreBadge({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs text-purple-800">
      {label} {value}/5
    </span>
  );
}

export function ReviewCard({ review, canReport, isOwn }: ReviewCardProps) {
  return (
    <article className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span>匿名同学</span>
            <span>·</span>
            <time dateTime={review.created_at}>
              {formatReviewDate(review.created_at)}
            </time>
            {isOwn && (
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-800">
                我的评价
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <ScoreBadge label="综合" value={review.rating} />
            <ScoreBadge label="难度" value={review.difficulty} />
            <ScoreBadge label="给分" value={review.grading} />
          </div>
        </div>

        {canReport && !isOwn && <ReportButton reviewId={review.id} />}
      </div>

      {review.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {review.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-purple-100 px-2.5 py-1 text-xs text-purple-700"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-gray-800">
        {review.content}
      </p>
    </article>
  );
}
