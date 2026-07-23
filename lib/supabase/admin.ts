import { createClient } from "@supabase/supabase-js";

/** 仅用于服务端脚本（如 Phase 2 批量导入），切勿暴露到前端 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
