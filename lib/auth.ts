import { ALLOWED_EMAIL_DOMAIN } from "@/lib/constants";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isAllowedEmail(email: string) {
  const normalized = normalizeEmail(email);
  return (
    normalized.endsWith(ALLOWED_EMAIL_DOMAIN) &&
    normalized.length > ALLOWED_EMAIL_DOMAIN.length
  );
}

export function getEmailError(email: string) {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    return "请输入邮箱地址";
  }

  if (!normalized.includes("@")) {
    return "邮箱格式不正确";
  }

  if (!isAllowedEmail(normalized)) {
    return `仅支持校内邮箱 ${ALLOWED_EMAIL_DOMAIN}`;
  }

  return null;
}

export function maskEmail(email: string) {
  const normalized = normalizeEmail(email);
  const [local, domain] = normalized.split("@");
  if (!local || !domain) return normalized;

  if (local.length <= 2) {
    return `${local[0] ?? "*"}***@${domain}`;
  }

  return `${local.slice(0, 2)}***@${domain}`;
}
