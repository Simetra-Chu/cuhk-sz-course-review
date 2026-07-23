"use client";

import { Loader2, LogIn, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoginDialog } from "@/components/auth/LoginDialog";
import { maskEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

type HeaderActionsProps = {
  email?: string | null;
};

export function HeaderActions({ email }: HeaderActionsProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setSigningOut(false);
    router.refresh();
  }

  if (email) {
    return (
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-purple-800 sm:inline">
          {maskEmail(email)}
        </span>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-white px-4 py-2 text-sm font-medium text-purple-900 transition hover:bg-purple-50 disabled:opacity-60"
        >
          {signingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          退出
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-purple-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-800"
      >
        <LogIn className="h-4 w-4" />
        登录
      </button>

      <LoginDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
}
