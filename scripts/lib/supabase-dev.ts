/**
 * Supabase 管理端连接：DEV 或 Production（正式库）
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function firstEnv(...keys: string[]) {
  for (const key of keys) {
    const v = process.env[key]?.trim();
    if (v) return { key, value: v };
  }
  return null;
}

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export type AdminTarget = "dev" | "prod";

export function createTargetAdminClient(target: AdminTarget): {
  client: SupabaseClient;
  urlKey: string;
  host: string;
  target: AdminTarget;
} {
  if (target === "prod") {
    const url = firstEnv("NEXT_PUBLIC_SUPABASE_URL");
    const key = firstEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      throw new Error(
        "缺少正式库凭证：需要 .env.local 中的 NEXT_PUBLIC_SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY"
      );
    }
    const client = createClient(url.value, key.value, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    return {
      client,
      urlKey: url.key,
      host: hostOf(url.value),
      target: "prod",
    };
  }

  const url = firstEnv(
    "SUPABASE_DEV_URL",
    "NEXT_PUBLIC_SUPABASE_URL_DEV",
    "SUPABASE_URL_DEV"
  );
  const key = firstEnv(
    "SUPABASE_DEV_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY_DEV"
  );

  if (!url || !key) {
    throw new Error(
      [
        "缺少 DEV 数据库凭证。请设置：",
        "  SUPABASE_DEV_URL=...",
        "  SUPABASE_DEV_SERVICE_ROLE_KEY=...",
      ].join("\n")
    );
  }

  const prodUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (prodUrl && hostOf(prodUrl) === hostOf(url.value)) {
    throw new Error(
      `DEV URL (${hostOf(url.value)}) 与 Production 相同，请改用 --import-prod`
    );
  }

  const client = createClient(url.value, key.value, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return {
    client,
    urlKey: url.key,
    host: hostOf(url.value),
    target: "dev",
  };
}

/** @deprecated 使用 createTargetAdminClient('dev') */
export function createDevAdminClient() {
  return createTargetAdminClient("dev");
}
