import pino from "pino";
import { env } from "./env";

/**
 * Logger centralizado com pino.
 * Em desenvolvimento usa pretty-print; em produção usa JSON estruturado.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
            ignore: "pid,hostname",
          },
        },
      }
    : {}),
  base: {
    service: "crm-automation",
    env: env.NODE_ENV,
  },
});
