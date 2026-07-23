import { TrendingUp, Star } from "lucide-react";
import { CourseCard } from "@/components/courses/CourseCard";
import { LeaderboardPanel } from "@/components/home/LeaderboardPanel";
import { SchoolFilter } from "@/components/home/SchoolFilter";
import { SearchForm } from "@/components/home/SearchForm";
import {
  MIN_REVIEWS_FOR_LEADERBOARD,
  SCHOOLS,
} from "@/lib/constants";
import {
  getHotCourses,
  getTopRatedCourses,
  parseSchoolParam,
  searchCourses,
} from "@/lib/courses";

type HomeProps = {
  searchParams?: {
    q?: string;
    school?: string;
  };
};

export default async function Home({ searchParams }: HomeProps) {
  const query = searchParams?.q?.trim() ?? "";
  const school = parseSchoolParam(searchParams?.school);
  const isFiltering = Boolean(query || school);

  const [
    searchResult,
    topRatedResult,
    hotResult,
  ] = await Promise.all([
    isFiltering
      ? searchCourses({ q: query || undefined, school })
      : Promise.resolve({ data: null, error: null }),
    getTopRatedCourses(),
    getHotCourses(),
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
      </section>

      <section className="mt-8 rounded-2xl border border-purple-100 bg-white p-6 shadow-sm">
        <label htmlFor="search" className="text-sm font-medium text-purple-900">
          搜索课程
        </label>
        <SearchForm defaultQuery={query} school={school} />
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-purple-900">按学院筛选</h2>
        <SchoolFilter activeSchool={school} query={query || undefined} />
      </section>

      {isFiltering && (
        <section className="mt-10 rounded-2xl border border-purple-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-purple-900">搜索结果</h2>
              <p className="mt-1 text-sm text-gray-600">
                {query && `关键词「${query}」`}
                {query && school && " · "}
                {school &&
                  `学院 ${SCHOOLS.find((s) => s.code === school)?.name ?? school}`}
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

      <section className="mt-10 grid gap-4 md:grid-cols-2">
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
      </section>
    </div>
  );
}
