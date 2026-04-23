# CRM Automation Platform

Plataforma de automacao de atendimento com classificacao de intencao por IA, persistencia no Supabase e orquestracao com n8n.

---

## Arquitetura

```text
Webhook (n8n)
   |
   v
POST /leads (Fastify + TypeScript)
   |
   +--> JWT obrigatorio
   +--> Rate limit
   +--> Classificacao de intencao (OpenAI -> Anthropic -> keywords)
   |
   v
Supabase (PostgreSQL)
   |
   v
n8n decide o roteamento por intencao
   +--> VENDAS
   +--> SUPORTE
   +--> OUTROS
```

---

## Estrutura

```text
crm-automation/
|-- docker-compose.yml
|-- .env.example
|-- README.md
|-- backend/
|   |-- Dockerfile
|   |-- package.json
|   |-- tsconfig.json
|   `-- src/
|       |-- server.ts
|       |-- app.bootstrap.ts
|       |-- config/
|       |   |-- env.ts
|       |   |-- logger.ts
|       |   `-- supabase.ts
|       |-- controllers/
|       |   |-- auth.controller.ts
|       |   `-- lead.controller.ts
|       |-- middlewares/
|       |   |-- auth.middleware.ts
|       |   `-- error.handler.ts
|       |-- routes/
|       |   |-- auth.routes.ts
|       |   |-- lead.routes.ts
|       |   `-- lead-secure.routes.ts
|       |-- services/
|       |   |-- ai.service.ts
|       |   |-- ai-fallback.service.ts
|       |   |-- auth.service.ts
|       |   `-- lead.service.ts
|       `-- types/
|           |-- fastify.d.ts
|           `-- index.ts
|-- n8n/
|   `-- workflow-lead-intake.json
`-- docs/
    `-- supabase-schema.sql
```

---

## Como rodar

### Pre-requisitos

- Docker e Docker Compose
- Conta no Supabase
- Chave da OpenAI ou Anthropic opcional

### 1. Clonar o projeto

```bash
git clone https://github.com/mrlptrcc/n8ncrm.git
cd crm-automation
cp .env.example .env
```

### 2. Configurar o `.env`

Exemplo minimo:

```env
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_KEY=your-service-role-key
API_KEY=sua-chave-interna
JWT_SECRET=uma-chave-longa-e-segura-com-16-ou-mais-caracteres
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=
PORT=3000
LOG_LEVEL=info
```

### 3. Subir os containers

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f backend
docker compose logs -f n8n
```

### 4. Configurar o Supabase

1. Crie um projeto no Supabase.
2. Execute o SQL em `docs/supabase-schema.sql`.
3. Copie `SUPABASE_URL` e `service_role key` para o `.env`.

### 5. Configurar o n8n

1. Acesse `http://localhost:5678`
2. Importe `n8n/workflow-lead-intake.json`
3. Configure as credenciais do Google Sheets
4. Ative o workflow

---

## Endpoints

### Publicos

#### `GET /health`

```bash
curl http://localhost:3000/health
```

Resposta:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-04-23T12:00:00.000Z",
    "env": "production"
  }
}
```

#### `POST /auth/token`

Gera um JWT valido por 24 horas.

```bash
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "sua-chave-interna"
  }'
```

Resposta:

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "24h"
  }
}
```

### Protegidos por JWT

Todas as rotas abaixo exigem:

```bash
-H "Authorization: Bearer SEU_TOKEN_AQUI"
```

#### `POST /leads`

```bash
curl -X POST http://localhost:3000/leads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{
    "name": "Joao Silva",
    "message": "Gostaria de saber o preco do plano Pro"
  }'
```

#### `GET /leads`

```bash
curl http://localhost:3000/leads \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

Filtros:

```bash
curl "http://localhost:3000/leads?intent=VENDAS" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"

curl "http://localhost:3000/leads?search=Joao" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"

curl "http://localhost:3000/leads?page=2&limit=10" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

#### `GET /leads/:id`

```bash
curl http://localhost:3000/leads/3f7a8b2c-1234-5678-abcd-ef0123456789 \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

#### `GET /leads/stats`

```bash
curl http://localhost:3000/leads/stats \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

Resposta:

```json
{
  "success": true,
  "data": {
    "total": 120,
    "by_intent": {
      "VENDAS": 50,
      "SUPORTE": 45,
      "OUTROS": 25
    },
    "last_7_days": 18,
    "last_30_days": 72
  }
}
```

---

## Fluxo de autenticacao JWT

1. O cliente envia `POST /auth/token` com `{ "apiKey": "..." }`.
2. O backend compara esse valor com `API_KEY` do ambiente.
3. Se bater, o Fastify assina um JWT com `JWT_SECRET`.
4. O token volta para o cliente com expiracao de `24h`.
5. Nas rotas `/leads`, o middleware chama `request.jwtVerify()`.
6. Se o token for valido, a request segue.
7. Se faltar token ou ele for invalido, a API responde `401`.

Exemplo de erro:

```json
{
  "success": false,
  "error": "Token invalido ou ausente"
}
```

### Como o JWT funciona no Fastify neste projeto

- O plugin `@fastify/jwt` e registrado em `backend/src/app.bootstrap.ts`.
- O segredo usado para assinar e validar tokens vem de `JWT_SECRET`.
- O endpoint `POST /auth/token` emite o token.
- O middleware `backend/src/middlewares/auth.middleware.ts` protege todas as rotas `/leads`.

---

## Rate limit

Limites atuais:

- Global: `60 requisicoes por minuto por IP`
- `POST /leads`: `10 requisicoes por minuto por IP`

### Como o rate limit funciona no Fastify neste projeto

- O plugin `@fastify/rate-limit` e registrado globalmente em `backend/src/app.bootstrap.ts`.
- Esse plugin aplica o limite base para todas as rotas.
- No `POST /leads`, existe uma configuracao por rota sobrescrevendo o limite para `10/min`.
- O controle e feito por IP.
- Quando o limite e atingido, a resposta segue o padrao `ApiResponse`.

Resposta esperada:

```json
{
  "success": false,
  "error": "Limite de requisicoes excedido. Tente novamente em instantes."
}
```

### Como testar o rate limit

Teste do limite especifico do `POST /leads`:

```bash
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:3000/leads \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer SEU_TOKEN_AQUI" \
    -d "{\"name\":\"Teste $i\",\"message\":\"Quero saber o preco do plano\"}"
done
```

Esperado:

- Requisicoes `1` a `10`: `201`
- Requisicoes `11` e `12`: `429`

Se voce estiver no PowerShell e quiser algo nativo:

```powershell
1..12 | ForEach-Object {
  $body = @{
    name = "Teste $_"
    message = "Quero saber o preco do plano"
  } | ConvertTo-Json

  try {
    $response = Invoke-WebRequest `
      -Uri "http://localhost:3000/leads" `
      -Method POST `
      -Headers @{
        Authorization = "Bearer SEU_TOKEN_AQUI"
      } `
      -ContentType "application/json" `
      -Body $body

    Write-Output $response.StatusCode
  } catch {
    Write-Output $_.Exception.Response.StatusCode.value__
  }
}
```

---

## Estatisticas

O endpoint `GET /leads/stats` retorna:

```json
{
  "total": 120,
  "by_intent": {
    "VENDAS": 50,
    "SUPORTE": 45,
    "OUTROS": 25
  },
  "last_7_days": 18,
  "last_30_days": 72
}
```

Significado:

- `total`: total geral de leads
- `by_intent`: total por intencao
- `last_7_days`: quantidade criada nos ultimos 7 dias
- `last_30_days`: quantidade criada nos ultimos 30 dias

Implementacao:

- A consulta e feita no `backend/src/services/lead.service.ts`
- Os dados sao buscados direto do Supabase com contagens agregadas

---

## Classificacao por IA

O backend hoje usa a funcao `classifyIntent()` em `backend/src/services/ai-fallback.service.ts`.

Fluxo:

1. Tenta o provider configurado em `AI_PROVIDER`
2. Se falhar, tenta o provider alternativo uma unica vez
3. Se os dois falharem, usa fallback por palavras-chave

Ordem:

```text
AI_PROVIDER=openai     -> OpenAI -> Anthropic -> keywords
AI_PROVIDER=anthropic  -> Anthropic -> OpenAI -> keywords
```

Os logs indicam qual provider teve sucesso.

---

## Variaveis de ambiente

| Variavel | Obrigatoria | Descricao |
|---|---|---|
| `SUPABASE_URL` | sim | URL do projeto Supabase |
| `SUPABASE_KEY` | sim | service_role key do Supabase |
| `API_KEY` | sim | chave usada para gerar JWT em `POST /auth/token` |
| `JWT_SECRET` | sim | segredo para assinar e validar o JWT |
| `AI_PROVIDER` | nao | `openai` ou `anthropic` |
| `OPENAI_API_KEY` | nao | chave da OpenAI |
| `ANTHROPIC_API_KEY` | nao | chave da Anthropic |
| `PORT` | nao | porta do backend, padrao `3000` |
| `LOG_LEVEL` | nao | nivel de log |
| `N8N_USER` | nao | usuario do n8n |
| `N8N_PASSWORD` | nao | senha do n8n |

---

## Testes manuais recomendados

### 1. Health check

```bash
curl http://localhost:3000/health
```

### 2. Gerar token

```bash
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"sua-chave-interna"}'
```

### 3. Criar lead autenticado

```bash
curl -X POST http://localhost:3000/leads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{"name":"Maria","message":"Preciso de suporte urgente"}'
```

### 4. Validar bloqueio sem token

```bash
curl http://localhost:3000/leads
```

### 5. Validar estatisticas

```bash
curl http://localhost:3000/leads/stats \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

### 6. Validar rate limit

Use um dos loops mostrados na secao de rate limit.

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js 20 |
| Linguagem | TypeScript 5 |
| Framework HTTP | Fastify 4 |
| Banco | Supabase / PostgreSQL |
| IA | OpenAI e Anthropic |
| Automacao | n8n |
| Logs | Pino |
| Validacao | Zod |
| Containers | Docker + Docker Compose |

---

## Licenca

MIT
