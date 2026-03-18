import { buildApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";

/**
 * Ponto de entrada da aplicação.
 * Inicializa o servidor e lida com erros fatais de boot.
 */
async function main(): Promise<void> {
  try {
    const app = await buildApp();

    await app.listen({
      port: env.PORT,
      host: "0.0.0.0", // Necessário para Docker
    });

    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      `🚀 Servidor iniciado em http://0.0.0.0:${env.PORT}`
    );
  } catch (err) {
    logger.fatal({ err }, "Falha ao iniciar servidor");
    process.exit(1);
  }
}

// ─── Graceful shutdown ───────────────────────
process.on("SIGTERM", () => {
  logger.info("Sinal SIGTERM recebido — encerrando graciosamente...");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("Sinal SIGINT recebido — encerrando...");
  process.exit(0);
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Promise não tratada detectada");
  process.exit(1);
});

main();
