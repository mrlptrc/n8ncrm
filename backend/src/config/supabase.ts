import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";
import { logger } from "./logger";

/**
 * Singleton do cliente Supabase.
 * Reutilizado em toda a aplicação para evitar múltiplas conexões.
 */
let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
      auth: {
        persistSession: false, // Backend não usa sessão de browser
        autoRefreshToken: false,
      },
    });
    logger.info("Supabase client initialized");
  }

  return supabaseInstance;
}
