import "@fastify/jwt";
import type { FastifyRateLimitOptions } from "@fastify/rate-limit";

declare module "fastify" {
  interface FastifyContextConfig {
    rateLimit?: FastifyRateLimitOptions;
  }
}
