"use client";

import { Loader2, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ReviewRequestButtonProps = {
  courseId: string;
  isLoggedIn: boolean;
  initialRequested: boolean;
  initialCount: number;
};

export function ReviewRequestButton({
  courseId,
  isLoggedIn,
  initialRequested,
  initialCount,
}: ReviewRequestButtonProps) {
  const router = useRouter();
  const [requested, setRequested] = useState(initialRequested);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleRequest() {
    if (!isLoggedIn || loading) return;

    setLoading(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      setError("登录状态已失效，请重新登录。");
      return;
    }

    const result = requested
      ? await supabase
          .from("review_requests")
          .delete()
          .eq("course_id", courseId)
          .eq("user_id", user.id)
      : await supabase.from("review_requests").insert({
          course_id: courseId,
          user_id: user.id,
        });

    setLoading(false);

    if (result.error) {
      if (!requested && result.error.code === "23505") {
        setRequested(true);
        router.refresh();
        return;
      }
      setError(result.error.message);
      return;
    }

    setRequested((current) => !current);
    setCount((current) => Math.max(0, current + (requested ? -1 : 1)));
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggleRequest}
        disabled={!isLoggedIn || loading}
        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
          requested
            ? "border-purple-700 bg-purple-700 text-white hover:bg-purple-800"
            : "border-purple-200 bg-white text-purple-800 hover:bg-purple-50"
        }`}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MessageCircle className="h-4 w-4" />
        )}
        {requested ? "已求评价" : "求评价"} · {count}
      </button>
      {!isLoggedIn && (
        <p className="mt-1.5 text-xs text-gray-500">登录后可为这门课求评价</p>
      )}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
