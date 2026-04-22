import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { logger } from "../config/logger";
import { generateAccessToken } from "../services/auth.service";
import type { ApiResponse, AuthTokenDTO, AuthTokenResponse } from "../types";

const authTokenSchema = z.object({
  apiKey: z.string().min(1, "apiKey é obrigatória"),
});

/**
 * Handler: POST /auth/token
 */
export async function createAuthTokenHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const parseResult = authTokenSchema.safeParse(request.body);

  if (!parseResult.success) {
    logger.warn(
      { errors: parseResult.error.flatten().fieldErrors },
      "Validação falhou em POST /auth/token"
    );

    const response: ApiResponse<null> = {
      success: false,
      error: "Dados inválidos",
      data: parseResult.error.flatten().fieldErrors as unknown as null,
    };

    reply.status(400).send(response);
    return;
  }

  try {
    const payload = parseResult.data as AuthTokenDTO;
    const token = await generateAccessToken(request.server, payload.apiKey);
    const response: ApiResponse<AuthTokenResponse> = {
      success: true,
      data: {
        token,
        expiresIn: "24h",
      },
    };

    reply.send(response);
  } catch (error) {
    logger.warn({ error }, "Falha ao emitir token JWT");
    reply.status(401).send({
      success: false,
      error: "Credenciais inválidas",
    } satisfies ApiResponse<null>);
  }
}
