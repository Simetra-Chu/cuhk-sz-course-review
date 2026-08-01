import { createClient } from "@/lib/supabase/server";
import type { DbCourse, DbReview } from "@/types/database";

export type ReviewWithCourse = DbReview & {
  course: Pick<DbCourse, "id" | "code" | "name_cn" | "name_en" | "school">;
};

export async function getRecentReviews(limit = 6) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(
      "*, course:courses(id,code,name_cn,name_en,school)"
    )
    .eq("status", "visible")
    .order("created_at", { ascending: false })
    .limit(limit);

  return { data: data as ReviewWithCourse[] | null, error };
}
