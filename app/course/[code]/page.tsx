import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Star } from "lucide-react";
import { CourseTabs } from "@/components/courses/CourseTabs";
import { DiscussionSection } from "@/components/courses/DiscussionSection";
import { PrerequisitesPanel } from "@/components/courses/PrerequisitesPanel";
import { ProfessorRecommendationSection } from "@/components/courses/ProfessorRecommendationSection";
import { ReviewRequestButton } from "@/components/courses/ReviewRequestButton";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { isAllowedEmail } from "@/lib/auth";
import {
  formatRating,
  getCourseByCode,
  getSchoolName,
} from "@/lib/courses";
import { createClient } from "@/lib/supabase/server";
import type {
  DbDiscussionPost,
  DbProfessorRecommendation,
  DbReview,
} from "@/types/database";

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

  const [reviewsResult, professorRecsResult, discussionsResult] =
    await Promise.all([
      supabase
        .from("reviews")
        .select("*")
        .eq("course_id", course.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("professor_recommendations")
        .select("*")
        .eq("course_id", course.id)
        .eq("status", "visible")
        .order("created_at", { ascending: false }),
      supabase
        .from("discussion_posts")
        .select("*")
        .eq("course_id", course.id)
        .eq("status", "visible")
        .order("created_at", { ascending: false }),
    ]);

  const reviews = (reviewsResult.data ?? []) as DbReview[];
  const professorRecs = professorRecsResult.error
    ? []
    : ((professorRecsResult.data ?? []) as DbProfessorRecommendation[]);
  const discussions = discussionsResult.error
    ? []
    : ((discussionsResult.data ?? []) as DbDiscussionPost[]);

  const authorScoresByUserId = Object.fromEntries(
    reviews.map((review) => [
      review.user_id,
      {
        rating: review.rating,
        difficulty: review.difficulty,
        grading: review.grading,
      },
    ])
  );

  let myReview: DbReview | null = null;
  let hasRequestedReview = false;
  let likedReviewIds = new Set<string>();
  let likedDiscussionIds = new Set<string>();

  if (user) {
    const reviewIds = reviews.map((item) => item.id);
    const discussionIds = discussions.map((item) => item.id);

    const [myReviewResult, myRequestResult, reviewLikesResult, discLikesResult] =
      await Promise.all([
        supabase
          .from("reviews")
          .select("*")
          .eq("course_id", course.id)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("review_requests")
          .select("id")
          .eq("course_id", course.id)
          .eq("user_id", user.id)
          .maybeSingle(),
        reviewIds.length > 0
          ? supabase
              .from("content_likes")
              .select("target_id")
              .eq("user_id", user.id)
              .eq("target_type", "review")
              .in("target_id", reviewIds)
          : Promise.resolve({ data: [] as { target_id: string }[] }),
        discussionIds.length > 0
          ? supabase
              .from("content_likes")
              .select("target_id")
              .eq("user_id", user.id)
              .eq("target_type", "discussion_post")
              .in("target_id", discussionIds)
          : Promise.resolve({ data: [] as { target_id: string }[] }),
      ]);

    myReview = myReviewResult.data as DbReview | null;
    hasRequestedReview = Boolean(myRequestResult.data);
    likedReviewIds = new Set(
      (reviewLikesResult.data ?? []).map((row) => row.target_id)
    );
    likedDiscussionIds = new Set(
      (discLikesResult.data ?? []).map((row) => row.target_id)
    );
  }

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
          <span>
            难度 {formatRating(course.avg_difficulty, course.review_count)}
            <span className="ml-1 text-xs text-gray-400">（高=难）</span>
          </span>
          <span>
            给分 {formatRating(course.avg_grading, course.review_count)}
            <span className="ml-1 text-xs text-gray-400">（高=慷慨）</span>
          </span>
          <span>{course.review_count} 条评价</span>
        </div>

        <div className="mt-5">
          <ReviewRequestButton
            courseId={course.id}
            isLoggedIn={isLoggedIn}
            initialRequested={hasRequestedReview}
            initialCount={course.request_count ?? 0}
          />
        </div>
      </section>

      <CourseTabs
        reviewCount={reviews.length}
        discussionCount={discussions.filter((post) => !post.parent_id).length}
        recommendationCount={professorRecs.length}
        reviews={
          <div className="space-y-4">
            <div id="write-review">
              {isLoggedIn ? (
                <ReviewForm courseId={course.id} existingReview={myReview} />
              ) : (
                <div className="rounded-2xl border border-dashed border-purple-200 bg-purple-50/40 p-6 text-sm text-purple-900">
                  登录后可发表评价。请使用右上角校内邮箱登录。
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-purple-900">
                全部评价 ({reviews.length})
              </h3>

              {reviews.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-purple-100 bg-white p-6">
                  <p className="text-sm text-gray-600">
                    还没有评价。可以求评价催一催，或自己写第一条。
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <ReviewRequestButton
                      courseId={course.id}
                      isLoggedIn={isLoggedIn}
                      initialRequested={hasRequestedReview}
                      initialCount={course.request_count ?? 0}
                    />
                    {isLoggedIn ? (
                      <a
                        href="#write-review"
                        className="inline-flex items-center rounded-xl bg-purple-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-800"
                      >
                        我来写第一条
                      </a>
                    ) : (
                      <p className="text-xs text-gray-500">
                        登录后即可在上方发表评价
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {reviews.map((review) => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      canReport={isLoggedIn}
                      isOwn={user?.id === review.user_id}
                      isLoggedIn={isLoggedIn}
                      initialLiked={likedReviewIds.has(review.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        }
        discussions={
          <DiscussionSection
            courseId={course.id}
            isLoggedIn={isLoggedIn}
            currentUserId={user?.id}
            initialPosts={discussions}
            likedPostIds={Array.from(likedDiscussionIds)}
            authorScoresByUserId={authorScoresByUserId}
          />
        }
        professors={
          <ProfessorRecommendationSection
            courseId={course.id}
            isLoggedIn={isLoggedIn}
            currentUserId={user?.id}
            initialItems={professorRecs}
            embedded
          />
        }
        prerequisites={
          <PrerequisitesPanel
            courseCode={course.code}
            prerequisite={course.prerequisite}
            corequisite={course.corequisite}
            exclusion={course.exclusion}
          />
        }
      />
    </div>
  );
}
