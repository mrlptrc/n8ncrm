import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { env } from "../config/env";
import { logger } from "../config/logger";
import type { ClassificationResult, LeadIntent } from "../types";

const SYSTEM_PROMPT = `Você é um assistente especializado em classificar mensagens de clientes.
Analise a mensagem fornecida e classifique a intenção em uma das três categorias:

- VENDAS: interesse em comprar, pedir preço, consultar produto, demonstração, upgrade de plano
- SUPORTE: problemas técnicos, dúvidas de uso, bugs, reclamações, cancelamento, reembolso
- OUTROS: qualquer mensagem que não se encaixe claramente nas categorias acima

Responda APENAS com um JSON válido no seguinte formato:
{
  "intent": "VENDAS" | "SUPORTE" | "OUTROS",
  "confidence": "high" | "medium" | "low",
  "reasoning": "breve explicação em uma frase"
}

Não inclua nenhum texto fora do JSON.`;

type AIProvider = "openai" | "anthropic";

async function classifyWithOpenAI(message: string): Promise<ClassificationResult> {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY não configurada");
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Mensagem: "${message}"` },
    ],
    temperature: 0.1,
    max_tokens: 150,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI retornou resposta vazia");
  }

  return JSON.parse(content) as ClassificationResult;
}

async function classifyWithAnthropic(message: string): Promise<ClassificationResult> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY não configurada");
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 150,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Mensagem: "${message}"` }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Anthropic retornou tipo inesperado");
  }

  return JSON.parse(content.text) as ClassificationResult;
}

function classifyWithKeywords(message: string): ClassificationResult {
  const lower = message.toLowerCase();

  const salesKeywords = [
    "comprar",
    "preço",
    "valor",
    "orçamento",
    "plano",
    "assinatura",
    "quanto custa",
    "contratar",
    "demonstração",
    "demo",
    "desconto",
    "upgrade",
    "trial",
    "teste grátis",
  ];

  const supportKeywords = [
    "problema",
    "erro",
    "bug",
    "não funciona",
    "ajuda",
    "dúvida",
    "cancelar",
    "reembolso",
    "suporte",
    "travou",
    "falhou",
    "lento",
    "não consigo",
    "como faço",
  ];

  const salesScore = salesKeywords.filter((kw) => lower.includes(kw)).length;
  const supportScore = supportKeywords.filter((kw) => lower.includes(kw)).length;

  let intent: LeadIntent = "OUTROS";
  if (salesScore > 0 && salesScore >= supportScore) {
    intent = "VENDAS";
  } else if (supportScore > 0) {
    intent = "SUPORTE";
  }

  const maxScore = Math.max(salesScore, supportScore);
  const confidence = maxScore >= 3 ? "high" : maxScore >= 1 ? "medium" : "low";

  return {
    intent,
    confidence,
    reasoning: "Classificação por palavras-chave (fallback sem IA)",
  };
}

/**
 * Classifica a intenção tentando o provider preferencial e depois o alternativo.
 */
export async function classifyIntent(
  message: string
): Promise<ClassificationResult> {
  const startTime = Date.now();
  const providers: AIProvider[] =
    env.AI_PROVIDER === "anthropic"
      ? ["anthropic", "openai"]
      : ["openai", "anthropic"];

  for (const provider of providers) {
    try {
      if (provider === "openai" && env.OPENAI_API_KEY) {
        const result = await classifyWithOpenAI(message);
        logger.info(
          {
            provider,
            intent: result.intent,
            confidence: result.confidence,
            elapsed_ms: Date.now() - startTime,
          },
          "Intenção classificada com sucesso"
        );
        return result;
      }

      if (provider === "anthropic" && env.ANTHROPIC_API_KEY) {
        const result = await classifyWithAnthropic(message);
        logger.info(
          {
            provider,
            intent: result.intent,
            confidence: result.confidence,
            elapsed_ms: Date.now() - startTime,
          },
          "Intenção classificada com sucesso"
        );
        return result;
      }
    } catch (error) {
      logger.warn(
        { error, provider, message },
        "Falha no provider de IA, tentando próximo provider"
      );
    }
  }

  logger.warn({ message }, "Todos os providers falharam, usando fallback por keywords");
  return classifyWithKeywords(message);
}
