"use client";

import { Loader2, LogIn, Mail, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/constants";
import { getEmailError, normalizeEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

type LoginDialogProps = {
  open: boolean;
  onClose: () => void;
};

type Step = "email" | "otp";

export function LoginDialog({ open, onClose }: LoginDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("email");
      setEmail("");
      setOtp("");
      setError(null);
      setMessage(null);
      setLoading(false);
      setAgreedToTerms(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSendOtp(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const emailError = getEmailError(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    if (!agreedToTerms) {
      setError("请先阅读并同意用户协议、免责声明与隐私说明");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const normalized = normalizeEmail(email);
    const redirectTo = `${window.location.origin}/auth/callback`;

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: redirectTo,
      },
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setStep("otp");
    setMessage(`验证码已发送至 ${normalized}，请查收邮件（含垃圾箱）。`);
  }

  async function handleVerifyOtp(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const code = otp.trim();
    if (!/^\d{6}$/.test(code)) {
      setError("请输入邮件中的 6 位验证码");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const normalized = normalizeEmail(email);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: normalized,
      token: code,
      type: "email",
    });

    setLoading(false);

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    onClose();
    router.refresh();
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="关闭登录窗口"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6"
      >
        <button
          type="button"
          aria-label="关闭"
          className="absolute right-4 top-4 rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 text-purple-900">
          <LogIn className="h-5 w-5" />
          <h2 id="login-title" className="text-lg font-semibold">
            校内邮箱登录
          </h2>
        </div>

        <p className="mt-2 text-sm text-gray-600">
          使用 {ALLOWED_EMAIL_DOMAIN} 邮箱收取验证码，无需密码。
        </p>

        {step === "email" ? (
          <form className="mt-6 space-y-4" onSubmit={handleSendOtp}>
            <div>
              <label
                htmlFor="login-email"
                className="text-sm font-medium text-purple-900"
              >
                邮箱地址
              </label>
              <div className="relative mt-2">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder={`your.name${ALLOWED_EMAIL_DOMAIN}`}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 outline-none ring-purple-200 focus:ring-2"
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-6 text-gray-600">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(event) => {
                  setAgreedToTerms(event.target.checked);
                  if (event.target.checked) setError(null);
                }}
                required
                className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-purple-700 accent-purple-700"
              />
              <span>
                我已阅读并同意
                <Link
                  href="/disclaimer#user-agreement"
                  target="_blank"
                  rel="noreferrer"
                  className="mx-1 text-purple-700 underline underline-offset-2 hover:text-purple-900"
                >
                  用户协议、免责声明与隐私说明
                </Link>
              </span>
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading || !agreedToTerms}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-700 py-3 text-sm font-medium text-white transition hover:bg-purple-800 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              发送验证码
            </button>
          </form>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleVerifyOtp}>
            {message && (
              <p className="rounded-xl bg-purple-50 px-3 py-2 text-sm text-purple-800">
                {message}
              </p>
            )}

            <div>
              <label
                htmlFor="login-otp"
                className="text-sm font-medium text-purple-900"
              >
                邮件验证码
              </label>
              <input
                id="login-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="输入 6 位数字"
                value={otp}
                onChange={(event) =>
                  setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-center text-lg tracking-[0.3em] outline-none ring-purple-200 focus:ring-2"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-700 py-3 text-sm font-medium text-white transition hover:bg-purple-800 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              验证并登录
            </button>

            <button
              type="button"
              className="w-full text-sm text-purple-700 hover:text-purple-900"
              onClick={() => {
                setStep("email");
                setOtp("");
                setError(null);
                setMessage(null);
              }}
            >
              更换邮箱
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
