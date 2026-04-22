import type { FastifyReply, FastifyRequest } from "fastify";
import { logger } from "../config/logger";
import type { ApiResponse } from "../types";

/**
 * Middleware que valida o JWT recebido no header Authorization.
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch (error) {
    logger.warn({ error, url: request.url }, "Acesso negado por JWT inválido");
    reply.status(401).send({
      success: false,
      error: "Token inválido ou ausente",
    } satisfies ApiResponse<null>);
  }
}
