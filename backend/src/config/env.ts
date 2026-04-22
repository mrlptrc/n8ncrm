import { z } from "zod";
import dotenv from "dotenv";

// Carrega variáveis de ambiente do arquivo .env
dotenv.config();

/**
 * Schema de validação das variáveis de ambiente.
 * A aplicação falha no boot se alguma variável obrigatória estiver ausente.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),

  // Supabase
  SUPABASE_URL: z.string().url("SUPABASE_URL deve ser uma URL válida"),
  SUPABASE_KEY: z.string().min(1, "SUPABASE_KEY é obrigatória"),

  // IA
  AI_PROVIDER: z.enum(["openai", "anthropic"]).default("openai"),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Segurança
  API_KEY: z.string().min(1, "API_KEY é obrigatória"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET deve ter ao menos 16 caracteres"),
});

// Valida e parseia — lança erro detalhado em caso de falha
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌  Variáveis de ambiente inválidas:\n",
    parsed.error.flatten().fieldErrors
  );
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
