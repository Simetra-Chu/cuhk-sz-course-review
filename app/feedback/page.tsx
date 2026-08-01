import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { isAllowedEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "用户反馈 | 港中深课程评价",
  description: "反馈缺少的课程、使用问题或功能建议",
};

type FeedbackPageProps = {
  searchParams?: {
    course?: string;
  };
};

export default async function FeedbackPage({ searchParams }: FeedbackPageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email =
    user?.email && isAllowedEmail(user.email) ? user.email : undefined;
  const initialCourseCode = searchParams?.course?.trim().toUpperCase() ?? "";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-purple-700 transition hover:text-purple-900"
      >
        <ArrowLeft className="h-4 w-4" />
        返回首页
      </Link>

      <section className="mt-6">
        <h1 className="text-2xl font-bold text-purple-950 sm:text-3xl">
          用户反馈
        </h1>
        <p className="mt-3 text-sm leading-7 text-gray-600">
          发现目录里没有某门课、页面报错，或有功能建议，都可以在这里告诉我们。
          反馈不会公开展示。
        </p>
      </section>

      <div className="mt-8">
        <FeedbackForm
          initialEmail={email}
          initialUserId={user?.id}
          initialCourseCode={initialCourseCode}
        />
      </div>
    </div>
  );
}
