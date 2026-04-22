import type { FastifyInstance } from "fastify";
import {
  createLeadHandler,
  getLeadHandler,
  listLeadsHandler,
} from "../controllers/lead.controller";

/**
 * Plugin de rotas para /leads.
 * Registrado com prefixo /leads no servidor principal.
 */
export async function leadRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /leads — cria um novo lead (com classificação por IA)
  fastify.post("/", createLeadHandler);

  // GET /leads — lista leads com paginação e filtros
  fastify.get("/", listLeadsHandler);

  // GET /leads/:id — busca lead por ID
  fastify.get("/:id", getLeadHandler);
}
