import type { FastifyInstance, FastifyError } from "fastify";
import { logger } from "../config/logger";
import type { ApiResponse } from "../types";

/**
 * Handler global de erros do Fastify.
 * Captura exceções não tratadas e retorna resposta padronizada.
 */
export function registerErrorHandler(fastify: FastifyInstance): void {
  fastify.setErrorHandler(
    (error: FastifyError, _request, reply) => {
      const statusCode = error.statusCode ?? 500;

      logger.error(
        {
          err: error,
          statusCode,
          url: _request.url,
          method: _request.method,
        },
        "Erro não tratado capturado"
      );

      // Não vaza detalhes de erro interno em produção
      const message =
        statusCode >= 500
          ? "Erro interno do servidor"
          : error.message;

      reply.status(statusCode).send({
        success: false,
        error: message,
        ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
      } satisfies ApiResponse<null> & { stack?: string });
    }
  );

  // Handler para rotas não encontradas
  fastify.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      success: false,
      error: `Rota ${_request.method} ${_request.url} não encontrada`,
    });
  });
}
