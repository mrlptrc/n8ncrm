# ─────────────────────────────────────────────
# Stage 1: Build
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Instala dependências de build
COPY package*.json ./
RUN npm ci --only=production=false

# Copia código-fonte e compila TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2: Runtime (imagem enxuta)
# ─────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Apenas dependências de produção
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copia build compilado
COPY --from=builder /app/dist ./dist

# Usuário não-root por segurança
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

CMD ["node", "dist/server.js"]
