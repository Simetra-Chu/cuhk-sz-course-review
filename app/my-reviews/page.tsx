import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { isAllowedEmail } from "@/lib/auth";
import { getSchoolName } from "@/lib/courses";
import { createClient } from "@/lib/supabase/server";
import type { DbCourse, DbReview } from "@/types/database";

type ReviewWithCourse = DbReview & {
  course: Pick<DbCourse, "id" | "code" | "name_cn" | "name_en" | "school">;
};

export default async function MyReviewsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = Boolean(user?.email && isAllowedEmail(user.email));

  if (!user || !isLoggedIn) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-purple-700 hover:text-purple-900"
        >
          <ArrowLeft className="h-4 w-4" />
          返回首页
        </Link>
        <div className="mt-6 rounded-2xl border border-purple-100 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-purple-950">我的评价</h1>
          <p className="mt-3 text-sm text-gray-600">
            请先使用右上角的校内邮箱登录。
          </p>
        </div>
      </div>
    );
  }

  const { data, error } = await supabase
    .from("reviews")
    .select(
      "*, course:courses(id,code,name_cn,name_en,school)"
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  const reviews = (data ?? []) as ReviewWithCourse[];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-purple-700 hover:text-purple-900"
      >
        <ArrowLeft className="h-4 w-4" />
        返回首页
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-purple-950 sm:text-3xl">
            我的评价
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            共 {reviews.length} 条；被隐藏的评价仅你本人可见。
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
          加载失败：{error.message}
        </p>
      ) : reviews.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-purple-100 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-gray-600">你还没有发表过评价。</p>
          <Link
            href="/"
            className="mt-4 inline-flex rounded-xl bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800"
          >
            浏览课程
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {reviews.map((review) => (
            <section key={review.id}>
              <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
                <Link
                  href={`/course/${review.course.code}`}
                  className="font-mono font-semibold text-purple-800 hover:underline"
                >
                  {review.course.code}
                </Link>
                <span className="text-sm font-medium text-purple-950">
                  {review.course.name_cn}
                </span>
                <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700">
                  {getSchoolName(review.course.school)}
                </span>
                {review.status === "hidden" && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
                    已隐藏
                  </span>
                )}
                <Link
                  href={`/course/${review.course.code}`}
                  className="ml-auto inline-flex items-center gap-1 text-xs text-purple-700 hover:underline"
                >
                  修改或删除
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
              <ReviewCard
                review={review}
                canReport={false}
                isOwn
                isLoggedIn
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
