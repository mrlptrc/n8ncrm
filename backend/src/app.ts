import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { leadRoutes } from "./routes/lead.routes";
import { registerErrorHandler } from "./middlewares/error.handler";

/**
 * Cria e configura a instância do Fastify.
 * Exportado separadamente para facilitar testes.
 */
export async function buildApp() {
  const app = Fastify({
    logger: false, // Usamos pino diretamente para controle fino
    trustProxy: true, // Para proxies reversos (nginx, etc.)
  });

  // ─── Plugins ────────────────────────────────
  await app.register(cors, {
    origin: true, // Em produção, restrinja para domínios específicos
    methods: ["GET", "POST", "PUT", "DELETE"],
  });

  // ─── Health Check ────────────────────────────
  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  }));

  // ─── Rotas de negócio ────────────────────────
  await app.register(leadRoutes, { prefix: "/leads" });

  // ─── Tratamento de erros ─────────────────────
  registerErrorHandler(app);

  // ─── Hooks de ciclo de vida ──────────────────
  app.addHook("onRequest", (request, _reply, done) => {
    logger.debug(
      { method: request.method, url: request.url },
      "→ Requisição recebida"
    );
    done();
  });

  app.addHook("onResponse", (request, reply, done) => {
    logger.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
      },
      "← Resposta enviada"
    );
    done();
  });

  return app;
}
