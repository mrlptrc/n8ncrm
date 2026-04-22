import type { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  createLead,
  getLeadById,
  getLeadStats,
  listLeads,
} from "../services/lead.service";
import { logger } from "../config/logger";
import type { ApiResponse, Lead, LeadStats, ListLeadsQuery } from "../types";

// ─────────────────────────────────────────────
// Schemas de validação com Zod
// ─────────────────────────────────────────────

const createLeadSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter ao menos 2 caracteres")
    .max(100, "Nome muito longo"),
  message: z
    .string()
    .min(5, "Mensagem deve ter ao menos 5 caracteres")
    .max(2000, "Mensagem muito longa"),
  intent: z.enum(["VENDAS", "SUPORTE", "OUTROS"]).optional(),
});

const listLeadsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  intent: z.enum(["VENDAS", "SUPORTE", "OUTROS"]).optional(),
  search: z.string().max(100).optional(),
});

// ─────────────────────────────────────────────
// Handler: POST /leads
// ─────────────────────────────────────────────

export async function createLeadHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const parseResult = createLeadSchema.safeParse(request.body);

  if (!parseResult.success) {
    const errors = parseResult.error.flatten().fieldErrors;
    logger.warn({ errors, body: request.body }, "Validação falhou em POST /leads");

    const response: ApiResponse<null> = {
      success: false,
      error: "Dados inválidos",
      data: errors as unknown as null,
    };
    reply.status(400).send(response);
    return;
  }

  try {
    const lead = await createLead(parseResult.data);
    const response: ApiResponse<Lead> = { success: true, data: lead };
    reply.status(201).send(response);
  } catch (err) {
    logger.error({ err }, "Erro interno em POST /leads");
    const response: ApiResponse<null> = {
      success: false,
      error: "Erro interno ao criar lead",
    };
    reply.status(500).send(response);
  }
}

// ─────────────────────────────────────────────
// Handler: GET /leads
// ─────────────────────────────────────────────

export async function listLeadsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const parseResult = listLeadsSchema.safeParse(request.query);

  if (!parseResult.success) {
    const response: ApiResponse<null> = {
      success: false,
      error: "Parâmetros de query inválidos",
    };
    reply.status(400).send(response);
    return;
  }

  const query = parseResult.data as ListLeadsQuery;

  try {
    const { leads, total } = await listLeads(query);
    const response: ApiResponse<Lead[]> = {
      success: true,
      data: leads,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
      },
    };
    reply.send(response);
  } catch (err) {
    logger.error({ err }, "Erro interno em GET /leads");
    const response: ApiResponse<null> = {
      success: false,
      error: "Erro interno ao listar leads",
    };
    reply.status(500).send(response);
  }
}

// ─────────────────────────────────────────────
// Handler: GET /leads/:id
// ─────────────────────────────────────────────

export async function getLeadHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params;

  if (!id || id.length < 10) {
    reply.status(400).send({ success: false, error: "ID inválido" });
    return;
  }

  try {
    const lead = await getLeadById(id);

    if (!lead) {
      reply.status(404).send({ success: false, error: "Lead não encontrado" });
      return;
    }

    reply.send({ success: true, data: lead });
  } catch (err) {
    logger.error({ err, id }, "Erro interno em GET /leads/:id");
    reply.status(500).send({ success: false, error: "Erro interno" });
  }
}

export async function getLeadStatsHandler(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const stats = await getLeadStats();
    const response: ApiResponse<LeadStats> = {
      success: true,
      data: stats,
    };

    reply.send(response);
  } catch (err) {
    logger.error({ err }, "Erro interno em GET /leads/stats");
    reply.status(500).send({
      success: false,
      error: "Erro interno ao consultar estatísticas dos leads",
    } satisfies ApiResponse<null>);
  }
}
