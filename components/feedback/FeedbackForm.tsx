"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import {
  FEEDBACK_CATEGORIES,
  MAX_FEEDBACK_CONTENT_LENGTH,
  MIN_FEEDBACK_CONTENT_LENGTH,
  type FeedbackCategory,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

type FeedbackFormProps = {
  initialEmail?: string | null;
  initialUserId?: string | null;
  initialCourseCode?: string;
};

export function FeedbackForm({
  initialEmail,
  initialUserId,
  initialCourseCode = "",
}: FeedbackFormProps) {
  const [category, setCategory] = useState<FeedbackCategory>("missing_course");
  const [courseCode, setCourseCode] = useState(initialCourseCode);
  const [content, setContent] = useState("");
  const [contactEmail, setContactEmail] = useState(initialEmail ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmed = content.trim();
    if (trimmed.length < MIN_FEEDBACK_CONTENT_LENGTH) {
      setError(`请至少填写 ${MIN_FEEDBACK_CONTENT_LENGTH} 个字`);
      return;
    }
    if (trimmed.length > MAX_FEEDBACK_CONTENT_LENGTH) {
      setError(`反馈内容最多 ${MAX_FEEDBACK_CONTENT_LENGTH} 个字`);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      category,
      content: trimmed,
      course_code: courseCode.trim() || null,
      contact_email: contactEmail.trim() || null,
      user_id: user?.id ?? initialUserId ?? null,
    };

    const { error: insertError } = await supabase
      .from("feedback")
      .insert(payload);

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setDone(true);
    setContent("");
    if (category === "missing_course") {
      setCourseCode("");
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-sm text-green-900">
        <p className="font-medium">感谢反馈，我们已收到。</p>
        <p className="mt-2 text-green-800">
          缺课、Bug 和建议都会人工查看，但未必逐条回复。需要时可再提交一条。
        </p>
        <button
          type="button"
          onClick={() => setDone(false)}
          className="mt-4 text-sm font-medium text-purple-700 underline-offset-2 hover:underline"
        >
          继续提交
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-purple-100 bg-white p-6 shadow-sm"
    >
      <fieldset>
        <legend className="text-sm font-medium text-purple-900">反馈类型</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {FEEDBACK_CATEGORIES.map((item) => {
            const active = category === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setCategory(item.value)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  active
                    ? "border-purple-700 bg-purple-700 text-white"
                    : "border-purple-200 bg-white text-purple-900 hover:border-purple-400 hover:bg-purple-50"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {(category === "missing_course" || category === "bug") && (
        <label className="mt-5 block text-sm font-medium text-purple-900">
          相关课程代码（可选）
          <input
            type="text"
            value={courseCode}
            maxLength={20}
            onChange={(event) => setCourseCode(event.target.value.toUpperCase())}
            placeholder="例如：CSC1001"
            className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 font-mono text-sm outline-none ring-purple-200 focus:ring-2"
          />
        </label>
      )}

      <label className="mt-5 block text-sm font-medium text-purple-900">
        详细说明
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={6}
          maxLength={MAX_FEEDBACK_CONTENT_LENGTH}
          placeholder={
            category === "missing_course"
              ? "请尽量写清：课程代码、课程名、学院/学期（如知道）。至少 10 个字。"
              : "请描述你遇到的问题或建议，越具体越好。至少 10 个字。"
          }
          className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none ring-purple-200 focus:ring-2"
        />
      </label>
      <p className="mt-2 text-xs text-gray-500">
        已输入 {content.trim().length}/{MAX_FEEDBACK_CONTENT_LENGTH}
      </p>

      <label className="mt-5 block text-sm font-medium text-purple-900">
        联系邮箱（可选）
        <input
          type="email"
          value={contactEmail}
          maxLength={120}
          onChange={(event) => setContactEmail(event.target.value)}
          placeholder="方便我们必要时联系你，可不填"
          className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none ring-purple-200 focus:ring-2"
        />
      </label>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-purple-700 px-5 py-3 text-sm font-medium text-white transition hover:bg-purple-800 disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        提交反馈
      </button>

      <p className="mt-3 text-xs text-gray-500">
        未登录也可提交。请勿填写密码、验证码等敏感信息。
      </p>
    </form>
  );
}
