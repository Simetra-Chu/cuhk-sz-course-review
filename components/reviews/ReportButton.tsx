"use client";

import { Flag, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ReportButtonProps = {
  reviewId: string;
};

export function ReportButton({ reviewId }: ReportButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReport() {
    const confirmed = window.confirm(
      "确认举报这条评价？若多人举报，系统会自动隐藏该内容。"
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      setError("请先登录后再举报。");
      return;
    }

    const reason = window.prompt("举报原因（可选）")?.trim();

    const { error: insertError } = await supabase.from("reports").insert({
      review_id: reviewId,
      user_id: user.id,
      reason: reason || null,
    });

    setLoading(false);

    if (insertError) {
      if (insertError.code === "23505") {
        setDone(true);
        return;
      }
      setError(insertError.message);
      return;
    }

    setDone(true);
    router.refresh();
  }

  if (done) {
    return <span className="text-xs text-gray-500">已举报</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleReport}
        disabled={loading}
        className="inline-flex items-center gap-1 text-xs text-gray-500 transition hover:text-red-600 disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Flag className="h-3.5 w-3.5" />
        )}
        举报
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
