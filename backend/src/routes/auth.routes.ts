import type { FastifyInstance } from "fastify";
import { createAuthTokenHandler } from "../controllers/auth.controller";

/**
 * Plugin de rotas para autenticação.
 */
export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post("/token", createAuthTokenHandler);
}
