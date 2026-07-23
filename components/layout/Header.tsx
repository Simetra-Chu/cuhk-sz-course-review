import Link from "next/link";
import { BookOpen } from "lucide-react";
import { HeaderActions } from "@/components/layout/HeaderActions";
import { isAllowedEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function Header() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email =
    user?.email && isAllowedEmail(user.email) ? user.email : undefined;

  return (
    <header className="sticky top-0 z-50 border-b border-purple-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-purple-900">
          <BookOpen className="h-6 w-6" />
          <div>
            <p className="text-sm font-semibold leading-tight">港中深课程评价</p>
            <p className="text-xs text-purple-600">CUHK-SZ Course Review</p>
          </div>
        </Link>

        <HeaderActions email={email} />
      </div>
    </header>
  );
}
