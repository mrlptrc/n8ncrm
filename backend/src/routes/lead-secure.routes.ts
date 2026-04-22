import type { FastifyInstance } from "fastify";
import {
  createLeadHandler,
  getLeadHandler,
  getLeadStatsHandler,
  listLeadsHandler,
} from "../controllers/lead.controller";
import { authenticate } from "../middlewares/auth.middleware";

/**
 * Plugin de rotas protegidas para /leads.
 */
export async function leadRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("onRequest", authenticate);

  fastify.get("/stats", getLeadStatsHandler);

  fastify.post(
    "/",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
    },
    createLeadHandler
  );

  fastify.get("/", listLeadsHandler);
  fastify.get("/:id", getLeadHandler);
}
