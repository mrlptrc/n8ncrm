import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env";
import { logger } from "../config/logger";
import type { ClassificationResult, LeadIntent } from "../types";

// ─────────────────────────────────────────────
// Prompt de sistema para classificação de intenção
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// Classificador via OpenAI
// ─────────────────────────────────────────────
async function classifyWithOpenAI(message: string): Promise<ClassificationResult> {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY não configurada");
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini", // Mais barato, suficiente para classificação
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Mensagem: "${message}"` },
    ],
    temperature: 0.1, // Baixa temperatura = respostas mais consistentes
    max_tokens: 150,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI retornou resposta vazia");

  return JSON.parse(content) as ClassificationResult;
}

// ─────────────────────────────────────────────
// Classificador via Anthropic (Claude)
// ─────────────────────────────────────────────
async function classifyWithAnthropic(message: string): Promise<ClassificationResult> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY não configurada");
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001", // Haiku = rápido e econômico para classificação
    max_tokens: 150,
    system: SYSTEM_PROMPT,
    messages: [
      { role: "user", content: `Mensagem: "${message}"` },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Anthropic retornou tipo inesperado");

  return JSON.parse(content.text) as ClassificationResult;
}

// ─────────────────────────────────────────────
// Fallback: classificação por palavras-chave (sem custo de API)
// Usado quando nenhuma chave de IA está configurada
// ─────────────────────────────────────────────
function classifyWithKeywords(message: string): ClassificationResult {
  const lower = message.toLowerCase();

  const salesKeywords = [
    "comprar", "preço", "valor", "orçamento", "plano", "assinatura",
    "quanto custa", "contratar", "demonstração", "demo", "desconto",
    "upgrade", "trial", "teste grátis",
  ];

  const supportKeywords = [
    "problema", "erro", "bug", "não funciona", "ajuda", "dúvida",
    "cancelar", "reembolso", "suporte", "travou", "falhou", "lento",
    "não consigo", "como faço",
  ];

  const salesScore = salesKeywords.filter((kw) => lower.includes(kw)).length;
  const supportScore = supportKeywords.filter((kw) => lower.includes(kw)).length;

  let intent: LeadIntent = "OUTROS";
  if (salesScore > 0 && salesScore >= supportScore) intent = "VENDAS";
  else if (supportScore > 0) intent = "SUPORTE";

  const maxScore = Math.max(salesScore, supportScore);
  const confidence =
    maxScore >= 3 ? "high" : maxScore >= 1 ? "medium" : "low";

  return {
    intent,
    confidence,
    reasoning: "Classificação por palavras-chave (fallback sem IA)",
  };
}

// ─────────────────────────────────────────────
// Função principal — exportada para uso nos services
// ─────────────────────────────────────────────

/**
 * Classifica a intenção de uma mensagem de lead.
 * Usa o provider configurado (openai | anthropic) ou fallback por keywords.
 *
 * @param message - Mensagem enviada pelo lead
 * @returns ClassificationResult com intent, confidence e reasoning
 */
export async function classifyIntent(
  message: string
): Promise<ClassificationResult> {
  const startTime = Date.now();

  try {
    let result: ClassificationResult;

    if (env.AI_PROVIDER === "anthropic" && env.ANTHROPIC_API_KEY) {
      logger.debug({ provider: "anthropic" }, "Classificando com Anthropic");
      result = await classifyWithAnthropic(message);
    } else if (env.AI_PROVIDER === "openai" && env.OPENAI_API_KEY) {
      logger.debug({ provider: "openai" }, "Classificando com OpenAI");
      result = await classifyWithOpenAI(message);
    } else {
      logger.warn("Nenhuma API de IA configurada — usando fallback por keywords");
      result = classifyWithKeywords(message);
    }

    const elapsed = Date.now() - startTime;
    logger.info(
      { intent: result.intent, confidence: result.confidence, elapsed_ms: elapsed },
      "Intenção classificada"
    );

    return result;
  } catch (error) {
    logger.error({ error, message }, "Falha na classificação de IA — usando fallback");
    // Fallback garantido em caso de erro de API
    return classifyWithKeywords(message);
  }
}
