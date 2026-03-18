import { getSupabaseClient } from "../config/supabase";
import { logger } from "../config/logger";
import { classifyIntent } from "./ai.service";
import type { Lead, CreateLeadDTO, ListLeadsQuery } from "../types";

const TABLE = "leads";

// ─────────────────────────────────────────────
// Criação de Lead
// ─────────────────────────────────────────────

/**
 * Cria um novo lead.
 * Se `intent` não for fornecido, chama a IA para classificar automaticamente.
 *
 * @param dto - Dados do lead (name, message, intent opcional)
 * @returns Lead criado com todos os campos preenchidos
 */
export async function createLead(dto: CreateLeadDTO): Promise<Lead> {
  const supabase = getSupabaseClient();

  // Classifica a intenção se não foi fornecida manualmente
  let intent = dto.intent;
  if (!intent) {
    const classification = await classifyIntent(dto.message);
    intent = classification.intent;
    logger.info(
      { name: dto.name, intent, confidence: classification.confidence },
      "Lead classificado pela IA"
    );
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ name: dto.name, message: dto.message, intent })
    .select()
    .single();

  if (error) {
    logger.error({ error, dto }, "Erro ao criar lead no Supabase");
    throw new Error(`Falha ao criar lead: ${error.message}`);
  }

  logger.info({ leadId: data.id, name: data.name, intent }, "Lead criado");
  return data as Lead;
}

// ─────────────────────────────────────────────
// Listagem de Leads
// ─────────────────────────────────────────────

/**
 * Lista leads com suporte a paginação, filtro por intenção e busca por texto.
 *
 * @param query - Parâmetros opcionais: page, limit, intent, search
 * @returns Array de leads e total de registros
 */
export async function listLeads(
  query: ListLeadsQuery = {}
): Promise<{ leads: Lead[]; total: number }> {
  const supabase = getSupabaseClient();

  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 20, 100); // Máximo 100 por página
  const offset = (page - 1) * limit;

  // Começa construindo a query base com contagem total
  let dbQuery = supabase
    .from(TABLE)
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  // Filtro por intenção
  if (query.intent) {
    dbQuery = dbQuery.eq("intent", query.intent);
  }

  // Busca por nome ou mensagem (case-insensitive)
  if (query.search) {
    dbQuery = dbQuery.or(
      `name.ilike.%${query.search}%,message.ilike.%${query.search}%`
    );
  }

  // Paginação
  dbQuery = dbQuery.range(offset, offset + limit - 1);

  const { data, error, count } = await dbQuery;

  if (error) {
    logger.error({ error, query }, "Erro ao listar leads");
    throw new Error(`Falha ao listar leads: ${error.message}`);
  }

  logger.debug({ total: count, page, limit }, "Leads listados");
  return { leads: (data as Lead[]) ?? [], total: count ?? 0 };
}

// ─────────────────────────────────────────────
// Busca por ID
// ─────────────────────────────────────────────

/**
 * Busca um lead específico pelo ID.
 */
export async function getLeadById(id: string): Promise<Lead | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    logger.error({ error, id }, "Erro ao buscar lead");
    throw new Error(`Falha ao buscar lead: ${error.message}`);
  }

  return data as Lead;
}
