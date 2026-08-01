"use client";

import { MessageSquarePlus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function FeedbackFab() {
  const pathname = usePathname();
  if (pathname === "/feedback") return null;

  return (
    <Link
      href="/feedback"
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-purple-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-900/25 transition hover:bg-purple-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-700 sm:bottom-8 sm:right-8 sm:px-5"
      aria-label="提交用户反馈"
    >
      <MessageSquarePlus className="h-5 w-5" />
      <span>反馈 / 缺课</span>
    </Link>
  );
}
