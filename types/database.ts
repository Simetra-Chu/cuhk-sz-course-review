import type { SchoolCode } from "@/lib/constants";

/** 与 Supabase public.courses 表对应 */
export type DbCourse = {
  id: string;
  code: string;
  name_cn: string;
  name_en: string | null;
  school: SchoolCode;
  avg_rating: number;
  avg_difficulty: number;
  avg_grading: number;
  review_count: number;
  created_at: string;
  updated_at: string;
};

/** 与 Supabase public.reviews 表对应 */
export type DbReview = {
  id: string;
  course_id: string;
  user_id: string;
  rating: number;
  difficulty: number;
  grading: number;
  tags: string[];
  content: string;
  status: "visible" | "hidden";
  report_count: number;
  created_at: string;
  updated_at: string;
};

/** 与 Supabase public.reports 表对应 */
export type DbReport = {
  id: string;
  review_id: string;
  user_id: string;
  reason: string | null;
  created_at: string;
};
