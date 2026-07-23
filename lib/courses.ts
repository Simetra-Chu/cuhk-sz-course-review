import {
  LEADERBOARD_LIMIT,
  MIN_REVIEWS_FOR_LEADERBOARD,
  SCHOOLS,
  type SchoolCode,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { DbCourse } from "@/types/database";

export function parseSchoolParam(value?: string): SchoolCode | undefined {
  if (!value) return undefined;
  return SCHOOLS.some((s) => s.code === value)
    ? (value as SchoolCode)
    : undefined;
}

export function buildHomeQuery(params: { q?: string; school?: SchoolCode }) {
  const searchParams = new URLSearchParams();
  if (params.q?.trim()) searchParams.set("q", params.q.trim());
  if (params.school) searchParams.set("school", params.school);
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
  limit?: number;
}) {
  const supabase = createClient();
  let query = supabase.from("courses").select("*");

  if (options.school) {
    query = query.eq("school", options.school);
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
