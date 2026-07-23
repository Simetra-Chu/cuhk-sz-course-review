import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Star } from "lucide-react";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { isAllowedEmail } from "@/lib/auth";
import {
  formatRating,
  getCourseByCode,
  getSchoolName,
} from "@/lib/courses";
import { createClient } from "@/lib/supabase/server";
import type { DbReview } from "@/types/database";

type CoursePageProps = {
  params: {
    code: string;
  };
};

export default async function CoursePage({ params }: CoursePageProps) {
  const supabase = createClient();
  const { data: course, error: courseError } = await getCourseByCode(params.code);

  if (courseError || !course) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoggedIn = Boolean(user?.email && isAllowedEmail(user.email));

  const { data: reviews } = await supabase
    .from("reviews")
    .select("*")
    .eq("course_id", course.id)
    .order("created_at", { ascending: false });

  let myReview: DbReview | null = null;
  if (user) {
    const { data } = await supabase
      .from("reviews")
      .select("*")
      .eq("course_id", course.id)
      .eq("user_id", user.id)
      .maybeSingle();
    myReview = data;
  }

  const visibleReviews = reviews ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-purple-700 transition hover:text-purple-900"
      >
        <ArrowLeft className="h-4 w-4" />
        返回首页
      </Link>

      <section className="mt-6 rounded-3xl border border-purple-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-lg font-semibold text-purple-900">
            {course.code}
          </span>
          <span className="rounded-full bg-purple-50 px-3 py-1 text-sm text-purple-700">
            {getSchoolName(course.school)}
          </span>
        </div>

        <h1 className="mt-3 text-2xl font-bold text-purple-950 sm:text-3xl">
          {course.name_cn}
        </h1>
        {course.name_en && (
          <p className="mt-2 text-gray-600">{course.name_en}</p>
        )}

        <div className="mt-6 flex flex-wrap gap-4 text-sm text-gray-700">
          <span className="inline-flex items-center gap-1">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            综合 {formatRating(course.avg_rating, course.review_count)}
          </span>
          <span>难度 {formatRating(course.avg_difficulty, course.review_count)}</span>
          <span>给分 {formatRating(course.avg_grading, course.review_count)}</span>
          <span>{course.review_count} 条评价</span>
        </div>
      </section>

      <section className="mt-8 space-y-4">
        {isLoggedIn ? (
          <ReviewForm courseId={course.id} existingReview={myReview} />
        ) : (
          <div className="rounded-2xl border border-dashed border-purple-200 bg-purple-50/40 p-6 text-sm text-purple-900">
            登录后可发表评价。Phase 6 登录功能已写好，可在右上角使用校内邮箱登录。
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold text-purple-900">
            全部评价 ({visibleReviews.length})
          </h2>

          {visibleReviews.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-purple-100 bg-white p-6 text-sm text-gray-600">
              还没有评价，成为第一个分享体验的人吧。
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {visibleReviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  canReport={isLoggedIn}
                  isOwn={user?.id === review.user_id}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
