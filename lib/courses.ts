import {
  COURSE_TERMS,
  LEADERBOARD_LIMIT,
  MIN_REVIEWS_FOR_LEADERBOARD,
  SCHOOLS,
  type CourseTerm,
  type SchoolCode,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { DbCourse } from "@/types/database";

export type CatalogCourse = Pick<
  DbCourse,
  "id" | "code" | "name_cn" | "name_en" | "subject_code"
>;

export function parseSchoolParam(value?: string): SchoolCode | undefined {
  if (!value) return undefined;
  return SCHOOLS.some((s) => s.code === value)
    ? (value as SchoolCode)
    : undefined;
}

export function parseTermParam(value?: string): CourseTerm | undefined {
  return COURSE_TERMS.find((term) => term === value);
}

export function buildHomeQuery(params: {
  q?: string;
  school?: SchoolCode;
  term?: CourseTerm;
}) {
  const searchParams = new URLSearchParams();
  if (params.q?.trim()) searchParams.set("q", params.q.trim());
  if (params.school) searchParams.set("school", params.school);
  if (params.term) searchParams.set("term", params.term);
  const query = searchParams.toString();
  return query ? `/?${query}` : "/";
}

export function getSchoolName(code: SchoolCode) {
  return SCHOOLS.find((s) => s.code === code)?.name ?? code;
}

export function formatRating(value: number, reviewCount: number) {
  if (reviewCount === 0) return "暂无";
  return value.toFixed(1);
}

function sanitizeSearchTerm(term: string) {
  return term.replace(/[%_,]/g, " ").trim();
}

export async function searchCourses(options: {
  q?: string;
  school?: SchoolCode;
  term?: CourseTerm;
  limit?: number;
}) {
  const supabase = createClient();
  let query = supabase.from("courses").select("*");

  if (options.school) {
    query = query.eq("school", options.school);
  }
  if (options.term) {
    query = query.contains("offered_terms", [options.term]);
  }

  const term = options.q ? sanitizeSearchTerm(options.q) : "";
  if (term) {
    query = query.or(
      `code.ilike.%${term}%,name_cn.ilike.%${term}%,name_en.ilike.%${term}%`
    );
  }

  const { data, error } = await query
    .order("code")
    .limit(options.limit ?? 50);

  return { data: data as DbCourse[] | null, error };
}

export async function getTopRatedCourses(
  limit = LEADERBOARD_LIMIT,
  minReviews = MIN_REVIEWS_FOR_LEADERBOARD
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .gte("review_count", minReviews)
    .order("avg_rating", { ascending: false })
    .order("review_count", { ascending: false })
    .limit(limit);

  return { data: data as DbCourse[] | null, error };
}

export async function getHotCourses(limit = LEADERBOARD_LIMIT) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .gt("review_count", 0)
    .order("review_count", { ascending: false })
    .order("avg_rating", { ascending: false })
    .limit(limit);

  return { data: data as DbCourse[] | null, error };
}

export async function getCourseByCode(code: string) {
  const supabase = createClient();
  const normalizedCode = code.trim().toUpperCase();

  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("code", normalizedCode)
    .maybeSingle();

  return { data: data as DbCourse | null, error };
}

export async function getCourseCatalog() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id,code,name_cn,name_en,subject_code")
    .not("subject_code", "is", null)
    .order("code")
    .limit(1_000);

  return { data: data as CatalogCourse[] | null, error };
}
