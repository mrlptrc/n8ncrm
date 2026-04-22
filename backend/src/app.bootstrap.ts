import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import fastifyRateLimit from "@fastify/rate-limit";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { registerErrorHandler } from "./middlewares/error.handler";
import { authRoutes } from "./routes/auth.routes";
import { leadRoutes } from "./routes/lead-secure.routes";
import type { ApiResponse } from "./types";

/**
 * Cria e configura a instância principal do Fastify.
 */
export async function buildApp() {
  const app = Fastify({
    logger: false,
    trustProxy: true,
  });

  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  });

  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
  });

  await app.register(fastifyRateLimit, {
    global: true,
    max: 60,
    timeWindow: "1 minute",
    errorResponseBuilder: (_request) =>
      ({
        success: false,
        error: "Limite de requisições excedido. Tente novamente em instantes.",
      } satisfies ApiResponse<null>),
  });

  app.get("/health", async () => ({
    success: true,
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
      env: env.NODE_ENV,
    },
  } satisfies ApiResponse<{ status: string; timestamp: string; env: string }>));

  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(leadRoutes, { prefix: "/leads" });

  registerErrorHandler(app);

  app.addHook("onRequest", (request, _reply, done) => {
    logger.debug({ method: request.method, url: request.url }, "Requisição recebida");
    done();
  });

  app.addHook("onResponse", (request, reply, done) => {
    logger.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
      },
      "Resposta enviada"
    );
    done();
  });

  return app;
}
