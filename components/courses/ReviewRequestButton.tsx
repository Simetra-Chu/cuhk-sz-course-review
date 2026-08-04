"use client";

import { Loader2, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    setRequested(initialRequested);
    setCount(initialCount);
  }, [initialRequested, initialCount, courseId]);

  async function syncCountFromServer() {
    const supabase = createClient();
    await supabase.rpc("refresh_course_request_count", {
      p_course_id: courseId,
    });
    const { data } = await supabase
      .from("courses")
      .select("request_count")
      .eq("id", courseId)
      .maybeSingle();
    return typeof data?.request_count === "number" ? data.request_count : null;
  }

  async function toggleRequest() {
    if (!isLoggedIn || loading) return;

    const wasRequested = requested;

    if (wasRequested) {
      const ok = window.confirm("确定取消求评价吗？取消后首页求评价榜会计数减少。");
      if (!ok) return;
    }

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

    const result = wasRequested
      ? await supabase
          .from("review_requests")
          .delete()
          .eq("course_id", courseId)
          .eq("user_id", user.id)
      : await supabase.from("review_requests").insert({
          course_id: courseId,
          user_id: user.id,
        });

    if (result.error) {
      setLoading(false);
      if (!wasRequested && result.error.code === "23505") {
        setRequested(true);
        const latest = await syncCountFromServer();
        if (latest != null) setCount(latest);
        router.refresh();
        return;
      }
      setError(result.error.message);
      return;
    }

    setRequested(!wasRequested);

    let latest = await syncCountFromServer();
    if (latest == null) {
      latest = Math.max(0, count + (wasRequested ? -1 : 1));
    }
    // 触发器偶发未更新时，至少保证「已求评价」显示不少于 1
    if (!wasRequested && latest < 1) {
      latest = 1;
    }
    setCount(latest);

    setLoading(false);
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggleRequest}
        disabled={!isLoggedIn || loading}
        aria-pressed={requested}
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
