import Link from "next/link";
import { MessageCircle, Star } from "lucide-react";
import { formatRating, getSchoolName } from "@/lib/courses";
import type { DbCourse } from "@/types/database";

type CourseCardProps = {
  course: DbCourse;
  rank?: number;
  compact?: boolean;
  metric?: "reviews" | "requests";
};

export function CourseCard({
  course,
  rank,
  compact,
  metric = "reviews",
}: CourseCardProps) {
  return (
    <Link
      href={`/course/${course.code}`}
      className="group flex items-start gap-3 rounded-xl border border-transparent p-3 transition hover:border-purple-100 hover:bg-purple-50/50"
    >
      {rank !== undefined && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-semibold text-purple-800">
          {rank}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-purple-900">
            {course.code}
          </span>
          <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700">
            {getSchoolName(course.school)}
          </span>
        </div>

        <p
          className={`mt-1 text-purple-950 group-hover:text-purple-800 ${
            compact ? "text-sm" : "font-medium"
          }`}
        >
          {course.name_cn}
        </p>

        {!compact &&
          course.name_en &&
          course.name_en.toLocaleLowerCase() !==
            course.name_cn.toLocaleLowerCase() && (
          <p className="mt-0.5 text-sm text-gray-500">{course.name_en}</p>
        )}

        {!compact && course.offered_terms?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {course.offered_terms.map((term) => (
              <span
                key={term}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                {term}
              </span>
            ))}
          </div>
        )}

        <div className="mt-2 flex items-center gap-3 text-xs text-gray-600">
          {metric === "requests" ? (
            <>
              <span className="inline-flex items-center gap-1 text-purple-700">
                <MessageCircle className="h-3.5 w-3.5" />
                {course.request_count ?? 0} 人求评价
              </span>
              <span>{course.review_count} 条评价</span>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                综合 {formatRating(course.avg_rating, course.review_count)}
              </span>
              <span>{course.review_count} 条评价</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
