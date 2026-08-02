import type { SchoolCode } from "@/lib/constants";

export type CourseSource = "manual" | "sis" | "registry";

/** 与 Supabase public.courses 表对应 */
export type DbCourse = {
  id: string;
  code: string;
  name_cn: string;
  name_en: string | null;
  school: SchoolCode;
  subject_code: string | null;
  subject_name: string | null;
  source: CourseSource;
  source_url: string | null;
  offered_terms: string[];
  prerequisite: string | null;
  corequisite: string | null;
  exclusion: string | null;
  last_synced_at: string | null;
  avg_rating: number;
  avg_difficulty: number;
  avg_grading: number;
  review_count: number;
  request_count: number;
  created_at: string;
  updated_at: string;
};

export type LikeTargetType = "review" | "discussion_post";

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
  like_count: number;
  created_at: string;
  updated_at: string;
};

/** 与 Supabase public.discussion_posts 表对应 */
export type DbDiscussionPost = {
  id: string;
  course_id: string;
  user_id: string;
  content: string;
  status: "visible" | "hidden";
  like_count: number;
  created_at: string;
  updated_at: string;
};

/** 与 Supabase public.content_likes 表对应 */
export type DbContentLike = {
  id: string;
  user_id: string;
  target_type: LikeTargetType;
  target_id: string;
  created_at: string;
};

/** 与 Supabase public.reports 表对应 */
export type DbReport = {
  id: string;
  review_id: string;
  user_id: string;
  reason: string | null;
  created_at: string;
};

/** 与 Supabase public.review_requests 表对应 */
export type DbReviewRequest = {
  id: string;
  course_id: string;
  user_id: string;
  created_at: string;
};

/** 与 Supabase public.professor_recommendations 表对应 */
export type DbProfessorRecommendation = {
  id: string;
  course_id: string;
  user_id: string;
  professor_name: string;
  content: string;
  status: "visible" | "hidden";
  created_at: string;
  updated_at: string;
};

/** 与 Supabase public.feedback 表对应 */
export type DbFeedback = {
  id: string;
  category: "missing_course" | "bug" | "suggestion" | "other";
  content: string;
  course_code: string | null;
  contact_email: string | null;
  user_id: string | null;
  created_at: string;
};
