"use client";

import { Heart, Loader2 } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LikeTargetType } from "@/types/database";

type LikeButtonProps = {
  targetType: LikeTargetType;
  targetId: string;
  initialCount: number;
  initialLiked: boolean;
  isLoggedIn: boolean;
};

export function LikeButton({
  targetType,
  targetId,
  initialCount,
  initialLiked,
  isLoggedIn,
}: LikeButtonProps) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleLike() {
    if (loading) return;

    if (!isLoggedIn) {
      setError("登录后可点赞");
      return;
    }

    setLoading(true);
    setError(null);

    const prevLiked = liked;
    const prevCount = count;
    setLiked(!prevLiked);
    setCount(Math.max(0, prevCount + (prevLiked ? -1 : 1)));

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLiked(prevLiked);
      setCount(prevCount);
      setLoading(false);
      setError("登录状态已失效，请重新登录。");
      return;
    }

    const result = prevLiked
      ? await supabase
          .from("content_likes")
          .delete()
          .eq("user_id", user.id)
          .eq("target_type", targetType)
          .eq("target_id", targetId)
      : await supabase.from("content_likes").insert({
          user_id: user.id,
          target_type: targetType,
          target_id: targetId,
        });

    setLoading(false);

    if (result.error) {
      if (!prevLiked && result.error.code === "23505") {
        setLiked(true);
        return;
      }
      setLiked(prevLiked);
      setCount(prevCount);
      setError(result.error.message);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggleLike}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
          liked
            ? "border-rose-300 bg-rose-50 text-rose-700"
            : "border-purple-100 bg-white text-gray-600 hover:border-purple-300 hover:bg-purple-50"
        }`}
        aria-pressed={liked}
        aria-label={liked ? "取消点赞" : "点赞"}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Heart
            className={`h-3.5 w-3.5 ${liked ? "fill-rose-500 text-rose-500" : ""}`}
          />
        )}
        {count}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
