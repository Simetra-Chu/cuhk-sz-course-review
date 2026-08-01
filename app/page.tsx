import Link from "next/link";
import { MessageCircle, MessageSquarePlus, TrendingUp, Star } from "lucide-react";
import { CourseCard } from "@/components/courses/CourseCard";
import { CourseCatalogBrowser } from "@/components/home/CourseCatalogBrowser";
import { LeaderboardPanel } from "@/components/home/LeaderboardPanel";
import { RecentReviewsFeed } from "@/components/home/RecentReviewsFeed";
import { SchoolFilter } from "@/components/home/SchoolFilter";
import { SearchForm } from "@/components/home/SearchForm";
import {
  MIN_REVIEWS_FOR_LEADERBOARD,
  SCHOOLS,
} from "@/lib/constants";
import {
  getCourseCatalog,
  getHotCourses,
  getMostRequestedCourses,
  getTopRatedCourses,
  parseSchoolParam,
  parseTermParam,
  searchCourses,
} from "@/lib/courses";
import { getRecentReviews } from "@/lib/review-queries";

type HomeProps = {
  searchParams?: {
    q?: string;
    school?: string;
    term?: string;
  };
};

export default async function Home({ searchParams }: HomeProps) {
  const query = searchParams?.q?.trim() ?? "";
  const school = parseSchoolParam(searchParams?.school);
  const term = parseTermParam(searchParams?.term);
  const isFiltering = Boolean(query || school || term);
  const filterDescriptions = [
    query ? `关键词「${query}」` : null,
    school
      ? `学院 ${SCHOOLS.find((item) => item.code === school)?.name ?? school}`
      : null,
    term ? `学期 ${term}` : null,
  ].filter(Boolean);

  const [
    searchResult,
    catalogResult,
    topRatedResult,
    hotResult,
    requestedResult,
    recentReviewsResult,
  ] = await Promise.all([
    isFiltering
      ? searchCourses({
          q: query || undefined,
          school,
          term,
          limit: 200,
        })
      : Promise.resolve({ data: null, error: null }),
    getCourseCatalog(),
    getTopRatedCourses(),
    getHotCourses(),
    getMostRequestedCourses(),
    getRecentReviews(),
  ]);

  const searchError = searchResult.error?.message;
  const courses = searchResult.data ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <section className="rounded-3xl bg-gradient-to-br from-purple-700 to-purple-900 px-6 py-10 text-white shadow-lg sm:px-10">
        <p className="text-sm uppercase tracking-[0.2em] text-purple-200">
          CUHK-SZ Course Review
        </p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
          港中深选课评价平台
        </h1>
        <p className="mt-4 max-w-2xl text-purple-100">
          帮你快速了解课程难度、给分与真实评价。无需登录即可浏览，发表评价需校内邮箱验证。
        </p>
        <Link
          href="/feedback"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-purple-800 transition hover:bg-purple-100"
        >
          <MessageSquarePlus className="h-4 w-4" />
          缺课或遇到问题？点这里反馈
        </Link>
      </section>

      <section className="mt-8 rounded-2xl border border-purple-100 bg-white p-6 shadow-sm">
        <label htmlFor="search" className="text-sm font-medium text-purple-900">
          搜索课程
        </label>
        <SearchForm
          defaultQuery={query}
          school={school}
          term={term}
        />
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-purple-900">浏览课程目录</h2>
        <p className="mt-1 text-sm text-gray-600">
          先选择学科代码首字母，再展开学科查看课程。
        </p>
        {catalogResult.error ? (
          <p className="mt-4 text-sm text-red-600">
            课程目录加载失败：{catalogResult.error.message}
          </p>
        ) : (
          <CourseCatalogBrowser courses={catalogResult.data ?? []} />
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-purple-900">按学院筛选</h2>
        <SchoolFilter
          activeSchool={school}
          query={query || undefined}
          term={term}
        />
      </section>

      {isFiltering && (
        <section className="mt-10 rounded-2xl border border-purple-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-purple-900">搜索结果</h2>
              <p className="mt-1 text-sm text-gray-600">
                {filterDescriptions.join(" · ")}
              </p>
            </div>
            <p className="text-sm text-gray-500">共 {courses.length} 门课</p>
          </div>

          {searchError ? (
            <p className="mt-4 text-sm text-red-600">搜索失败：{searchError}</p>
          ) : courses.length === 0 ? (
            <p className="mt-4 text-sm text-gray-600">
              没有找到匹配的课程。试试换个关键词，或先去掉学院筛选。
            </p>
          ) : (
            <div className="mt-4 divide-y divide-purple-50">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <LeaderboardPanel
          title="高分榜"
          icon={Star}
          courses={topRatedResult.data ?? []}
          hint={`至少 ${MIN_REVIEWS_FOR_LEADERBOARD} 条评价才计入，按综合分排序`}
          emptyMessage="暂无足够评价的课程。发表评价后，高分榜会自动更新。"
        />

        <LeaderboardPanel
          title="热度榜"
          icon={TrendingUp}
          courses={hotResult.data ?? []}
          hint="按评价数量排序"
          emptyMessage="还没有课程收到评价。成为第一个分享体验的人吧。"
        />

        <LeaderboardPanel
          title="求评价榜"
          icon={MessageCircle}
          courses={requestedResult.data ?? []}
          metric="requests"
          hint="按求评价人数排序，所有课程均可上榜"
          emptyMessage="还没有人求评价。可以在课程详情页为关心的课程求评价。"
        />
      </section>

      <RecentReviewsFeed reviews={recentReviewsResult.data ?? []} />
    </div>
  );
}
