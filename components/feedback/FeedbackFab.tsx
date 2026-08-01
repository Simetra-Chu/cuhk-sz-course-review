"use client";

import { MessageSquarePlus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function FeedbackFab() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      const scrolled = window.scrollY > 280;
      const nearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 120;
      setVisible(scrolled || nearBottom);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  if (pathname === "/feedback" || !visible) return null;

  return (
    <Link
      href="/feedback"
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-1.5 rounded-full bg-purple-700/95 px-3 py-2.5 text-xs font-semibold text-white shadow-md shadow-purple-900/20 backdrop-blur transition hover:bg-purple-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-700 sm:bottom-7 sm:right-7 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm"
      aria-label="提交用户反馈"
    >
      <MessageSquarePlus className="h-4 w-4 sm:h-5 sm:w-5" />
      <span className="sm:hidden">反馈</span>
      <span className="hidden sm:inline">反馈 / 缺课</span>
    </Link>
  );
}
