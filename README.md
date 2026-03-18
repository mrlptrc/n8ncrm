# 🤖 CRM Automation Platform

Plataforma de automação de atendimento com classificação de intenção por IA, integração com n8n, Supabase e Google Sheets.

---

## 📐 Arquitetura

```
Webhook (n8n) 
    │
    ▼
Validação & Normalização (n8n Code Node)
    │
    ▼
POST /leads (Backend Node.js/TypeScript)
    │
    ├──► Classificação de Intenção (OpenAI / Claude / Fallback)
    │
    ▼
Supabase (PostgreSQL)
    │
    ▼
Roteamento por Intenção (n8n IF Node)
    │
    ├── VENDAS  ──► Google Sheets (aba Vendas)
    ├── SUPORTE ──► Google Sheets (aba Suporte)
    └── OUTROS  ──► Google Sheets (aba Outros)
```

---

## 🗂 Estrutura de Pastas

```
crm-automation/
├── docker-compose.yml          # Orquestração dos containers
├── .env.example                # Template de variáveis de ambiente
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts           # Entrypoint + graceful shutdown
│       ├── app.ts              # Setup Fastify + plugins + rotas
│       ├── types/
│       │   └── index.ts        # Interfaces e tipos centrais
│       ├── config/
│       │   ├── env.ts          # Validação de variáveis (Zod)
│       │   ├── logger.ts       # Logger Pino
│       │   └── supabase.ts     # Client Supabase (singleton)
│       ├── controllers/
│       │   └── lead.controller.ts   # Validação HTTP + resposta
│       ├── services/
│       │   ├── lead.service.ts      # Lógica de negócio + Supabase
│       │   └── ai.service.ts        # Classificação por IA
│       ├── routes/
│       │   └── lead.routes.ts       # Registro das rotas
│       └── middlewares/
│           └── error.handler.ts     # Tratamento global de erros
│
├── n8n/
│   └── workflow-lead-intake.json   # Workflow exportado (import no n8n)
│
└── docs/
    └── supabase-schema.sql         # SQL para criar a tabela no Supabase
```

---

## 🚀 Como Rodar

### Pré-requisitos

- Docker e Docker Compose instalados
- Conta no [Supabase](https://supabase.com) (gratuita)
- Chave de API: OpenAI **ou** Anthropic (opcional — há fallback por keywords)

---

### 1. Clone e configure o ambiente

```bash
git clone https://github.com/seu-usuario/crm-automation.git
cd crm-automation

# Cria seu .env a partir do template
cp .env.example .env
```

Edite o `.env` com seus dados reais:

```env
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_KEY=your-service-role-key
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

---

### 2. Configure o Supabase

1. Acesse [app.supabase.com](https://app.supabase.com) e crie um projeto
2. Vá em **SQL Editor** → **New Query**
3. Cole e execute o conteúdo de `docs/supabase-schema.sql`
4. Copie a **URL** e a **service_role key** de **Settings → API** para o seu `.env`

> ⚠️ Use `service_role` key no backend (não a `anon` key) para contornar o RLS.

---

### 3. Suba os containers

```bash
# Primeira vez (build + start)
docker compose up --build -d

# Verificar status
docker compose ps

# Acompanhar logs em tempo real
docker compose logs -f

# Logs de um serviço específico
docker compose logs -f backend
docker compose logs -f n8n
```

---

### 4. Configure o n8n

1. Acesse `http://localhost:5678`
2. Login: `admin` / `admin123` (ou o que configurou no `.env`)
3. Vá em **Workflows → Import from File**
4. Importe `n8n/workflow-lead-intake.json`
5. Configure a credencial do Google Sheets:
   - Menu lateral → **Credentials → New → Google Sheets OAuth2**
   - Siga o fluxo de autorização
6. Substitua `YOUR_GOOGLE_SHEET_ID_*` nos nodes pelo ID real das suas planilhas
7. Ative o workflow com o toggle no canto superior direito

> O ID da planilha está na URL: `https://docs.google.com/spreadsheets/d/**ID_AQUI**/edit`

---

## 📡 Endpoints da API

### `POST /leads` — Criar lead

```bash
curl -X POST http://localhost:3000/leads \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "message": "Gostaria de saber o preço do plano Pro"
  }'
```

**Resposta (201):**
```json
{
  "success": true,
  "data": {
    "id": "3f7a8b2c-1234-5678-abcd-ef0123456789",
    "name": "João Silva",
    "message": "Gostaria de saber o preço do plano Pro",
    "intent": "VENDAS",
    "created_at": "2025-01-15T14:30:00.000Z"
  }
}
```

---

### `GET /leads` — Listar leads

```bash
# Todos os leads (paginado)
curl http://localhost:3000/leads

# Filtrar por intenção
curl "http://localhost:3000/leads?intent=VENDAS"

# Busca por texto
curl "http://localhost:3000/leads?search=João"

# Paginação
curl "http://localhost:3000/leads?page=2&limit=10"
```

**Resposta (200):**
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20
  }
}
```

---

### `GET /leads/:id` — Buscar por ID

```bash
curl http://localhost:3000/leads/3f7a8b2c-1234-5678-abcd-ef0123456789
```

---

### `GET /health` — Health Check

```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":"...","env":"production"}
```

---

## 🧠 Classificação por IA

A função `classifyIntent()` em `src/services/ai.service.ts` recebe a mensagem e retorna:

```typescript
{
  intent: "VENDAS" | "SUPORTE" | "OUTROS",
  confidence: "high" | "medium" | "low",
  reasoning: "breve explicação"
}
```

### Lógica de seleção do provider:

```
AI_PROVIDER=anthropic + ANTHROPIC_API_KEY presente → usa Claude Haiku
AI_PROVIDER=openai   + OPENAI_API_KEY presente    → usa GPT-4o Mini
Nenhuma chave configurada                          → fallback por keywords (sem custo)
Erro na API de IA                                  → fallback automático por keywords
```

### Exemplos de classificação:

| Mensagem | Intenção | Confidence |
|----------|----------|------------|
| "Quero contratar o plano anual, qual o preço?" | VENDAS | high |
| "O sistema travou e não consigo acessar" | SUPORTE | high |
| "Qual o horário de funcionamento?" | OUTROS | medium |
| "Podem me ajudar com minha conta?" | SUPORTE | medium |

---

## 🔄 Fluxo do Workflow n8n

```
1. Webhook POST /webhook/lead-intake
       ↓
2. Code Node: valida campos obrigatórios (name, message)
       ↓
3. HTTP Request: POST http://backend:3000/leads
   → Backend chama IA → salva no Supabase → retorna lead com intent
       ↓
4. IF Node "É VENDAS?": checa se intent === "VENDAS"
   ├── TRUE  → Google Sheets (aba Vendas)
   └── FALSE → IF Node "É SUPORTE?"
                ├── TRUE  → Google Sheets (aba Suporte)
                └── FALSE → Google Sheets (aba Outros)
       ↓
5. Respond to Webhook: retorna JSON com lead processado
```

---

## 🐋 Comandos Docker úteis

```bash
# Subir tudo em background
docker compose up -d

# Subir com rebuild forçado (após mudanças no código)
docker compose up --build -d

# Parar todos os containers
docker compose down

# Parar e remover volumes (reseta n8n)
docker compose down -v

# Ver logs em tempo real
docker compose logs -f

# Entrar no container do backend
docker compose exec backend sh

# Restart de um serviço específico
docker compose restart backend

# Verificar uso de recursos
docker stats
```

---

## 📊 Google Sheets — Configuração

### Estrutura esperada nas planilhas

Crie uma planilha com 3 abas: **Vendas**, **Suporte**, **Outros**

Cada aba deve ter os seguintes cabeçalhos na linha 1:

| ID | Nome | Mensagem | Intenção | Data |
|----|------|----------|----------|------|

O n8n preencherá automaticamente cada linha conforme os leads chegam.

### Como obter credenciais do Google Sheets

1. Acesse [Google Cloud Console](https://console.cloud.google.com)
2. Crie um projeto → Ative a **Google Sheets API**
3. Crie credenciais OAuth 2.0 (tipo: "Web application")
4. Configure o redirect URI: `http://localhost:5678/rest/oauth2-credential/callback`
5. No n8n: **Credentials → Google Sheets OAuth2** → cole Client ID e Secret → autorize

---

## ⚙️ Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `SUPABASE_URL` | ✅ | URL do projeto Supabase |
| `SUPABASE_KEY` | ✅ | service_role key do Supabase |
| `AI_PROVIDER` | ❌ | `openai` (padrão) ou `anthropic` |
| `OPENAI_API_KEY` | ❌ | Chave da OpenAI (se AI_PROVIDER=openai) |
| `ANTHROPIC_API_KEY` | ❌ | Chave Anthropic (se AI_PROVIDER=anthropic) |
| `PORT` | ❌ | Porta do backend (padrão: 3000) |
| `LOG_LEVEL` | ❌ | `debug`, `info`, `warn`, `error` |
| `N8N_USER` | ❌ | Usuário do n8n (padrão: admin) |
| `N8N_PASSWORD` | ❌ | Senha do n8n (padrão: admin123) |

---

## 🛡️ Boas Práticas Implementadas

- **Validação de entrada** com Zod (schema-first, erros descritivos)
- **Separação de responsabilidades**: controller → service → config
- **Graceful shutdown** no SIGTERM/SIGINT
- **Logger estruturado** (pino) com níveis e contexto
- **Fallback de IA** garante funcionamento mesmo sem chaves configuradas
- **Singleton** no cliente Supabase (evita múltiplas conexões)
- **Multi-stage Docker build** (imagem de produção enxuta)
- **Usuário não-root** no container por segurança
- **RLS habilitado** no Supabase por padrão
- **Health check** para monitoramento e orchestration

---

## 🧪 Testando o Webhook do n8n

Com o workflow ativo, envie um POST diretamente para o n8n:

```bash
curl -X POST http://localhost:5678/webhook/lead-intake \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teste Webhook",
    "message": "Preciso de suporte urgente com minha conta"
  }'
```

O n8n irá processar, chamar o backend, classificar a intenção com IA e inserir na planilha correta.

---

## 📦 Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Runtime | Node.js 20 |
| Linguagem | TypeScript 5 |
| Framework HTTP | Fastify 4 |
| Banco de Dados | Supabase (PostgreSQL) |
| IA | OpenAI GPT-4o Mini / Claude Haiku |
| Automação | n8n (self-hosted) |
| Logs | Pino |
| Validação | Zod |
| Containers | Docker + Docker Compose |

---

## 📄 Licença

MIT — use à vontade para portfólio, projetos e aprendizado.
