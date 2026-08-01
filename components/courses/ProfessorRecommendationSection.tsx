"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  MAX_PROFESSOR_NAME_LENGTH,
  MIN_PROFESSOR_NAME_LENGTH,
  MIN_PROFESSOR_REC_CONTENT_LENGTH,
} from "@/lib/constants";
import { formatReviewDate } from "@/lib/reviews";
import { createClient } from "@/lib/supabase/client";
import type { DbProfessorRecommendation } from "@/types/database";

type ProfessorRecommendationSectionProps = {
  courseId: string;
  isLoggedIn: boolean;
  currentUserId?: string | null;
  initialItems: DbProfessorRecommendation[];
};

export function ProfessorRecommendationSection({
  courseId,
  isLoggedIn,
  currentUserId,
  initialItems,
}: ProfessorRecommendationSectionProps) {
  const router = useRouter();
  const [professorName, setProfessorName] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const name = professorName.trim();
    const reason = content.trim();

    if (
      name.length < MIN_PROFESSOR_NAME_LENGTH ||
      name.length > MAX_PROFESSOR_NAME_LENGTH
    ) {
      setError(
        `教授姓名需为 ${MIN_PROFESSOR_NAME_LENGTH}–${MAX_PROFESSOR_NAME_LENGTH} 个字`
      );
      return;
    }
    if (reason.length < MIN_PROFESSOR_REC_CONTENT_LENGTH) {
      setError(`推荐理由至少 ${MIN_PROFESSOR_REC_CONTENT_LENGTH} 个字`);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      setError("请先登录后再推荐教授。");
      return;
    }

    const { error: insertError } = await supabase
      .from("professor_recommendations")
      .insert({
        course_id: courseId,
        user_id: user.id,
        professor_name: name,
        content: reason,
      });

    setLoading(false);

    if (insertError) {
      if (insertError.code === "23505") {
        setError("你已经推荐过这位教授，可先删除原条目再重新填写。");
        return;
      }
      setError(insertError.message);
      return;
    }

    setProfessorName("");
    setContent("");
    setMessage("已发布推荐。");
    router.refresh();
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("确定删除这条推荐吗？");
    if (!confirmed) return;

    setDeletingId(id);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("professor_recommendations")
      .delete()
      .eq("id", id);

    setDeletingId(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    router.refresh();
  }

  return (
    <section className="mt-8 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-purple-900">推荐教授</h2>
        <p className="mt-1 text-sm text-gray-600">
          分享你愿意推荐的授课老师与理由。匿名展示，不做票数汇总，仅供参考。
        </p>
      </div>

      {isLoggedIn ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm"
        >
          <label className="block text-sm font-medium text-purple-900">
            教授姓名
            <input
              type="text"
              value={professorName}
              maxLength={MAX_PROFESSOR_NAME_LENGTH}
              onChange={(event) => setProfessorName(event.target.value)}
              placeholder="例如：张三 / ZHANG San"
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none ring-purple-200 focus:ring-2"
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-purple-900">
            推荐理由
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={3}
              placeholder={`为什么推荐这位老师？至少 ${MIN_PROFESSOR_REC_CONTENT_LENGTH} 个字。请理性表达，勿人身攻击。`}
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none ring-purple-200 focus:ring-2"
            />
          </label>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          {message && <p className="mt-3 text-sm text-green-700">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-purple-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-purple-800 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            发布推荐
          </button>
        </form>
      ) : (
        <div className="rounded-2xl border border-dashed border-purple-200 bg-purple-50/40 p-5 text-sm text-purple-900">
          登录后可在本专栏推荐教授。
        </div>
      )}

      <div className="space-y-3">
        {initialItems.length === 0 ? (
          <p className="rounded-2xl border border-purple-100 bg-white p-5 text-sm text-gray-600">
            还没有推荐，欢迎进来分享。
          </p>
        ) : (
          initialItems.map((item) => {
            const isOwn = currentUserId === item.user_id;
            return (
              <article
                key={item.id}
                className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-purple-950">
                      {item.professor_name}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500">
                      匿名同学 ·{" "}
                      <time dateTime={item.created_at}>
                        {formatReviewDate(item.created_at)}
                      </time>
                      {isOwn && (
                        <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-800">
                          我的推荐
                        </span>
                      )}
                    </p>
                  </div>
                  {isOwn && (
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      删除
                    </button>
                  )}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-800">
                  {item.content}
                </p>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
