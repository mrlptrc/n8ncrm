import type { FastifyInstance } from "fastify";
import { env } from "../config/env";
import { logger } from "../config/logger";

/**
 * Valida a API key recebida e emite um JWT com validade de 24 horas.
 */
export async function generateAccessToken(
  fastify: FastifyInstance,
  apiKey: string
): Promise<string> {
  if (apiKey !== env.API_KEY) {
    logger.warn("Tentativa de autenticação com API key inválida");
    throw new Error("API key inválida");
  }

  const token = await fastify.jwt.sign(
    { scope: "api" },
    { expiresIn: "24h" }
  );

  logger.info("JWT emitido com sucesso");
  return token;
}
