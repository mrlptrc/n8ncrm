// ─────────────────────────────────────────────
// Tipos centrais da aplicação
// ─────────────────────────────────────────────

/**
 * Intenções possíveis classificadas pela IA.
 * Cada mensagem de lead é categorizada em um desses valores.
 */
export type LeadIntent = "VENDAS" | "SUPORTE" | "OUTROS";

/**
 * Modelo de Lead conforme tabela no Supabase.
 */
export interface Lead {
  id: string;
  name: string;
  message: string;
  intent: LeadIntent;
  created_at: string;
}

/**
 * Payload recebido no POST /leads.
 * O campo `intent` é opcional — se ausente, a IA classifica automaticamente.
 */
export interface CreateLeadDTO {
  name: string;
  message: string;
  intent?: LeadIntent;
}

/**
 * Envelope de resposta padrão da API.
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

/**
 * Parâmetros de query para listagem de leads.
 */
export interface ListLeadsQuery {
  page?: number;
  limit?: number;
  intent?: LeadIntent;
  search?: string;
}

/**
 * Resultado da classificação pela IA.
 */
export interface ClassificationResult {
  intent: LeadIntent;
  confidence: "high" | "medium" | "low";
  reasoning?: string;
}
