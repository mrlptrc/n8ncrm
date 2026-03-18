-- ═══════════════════════════════════════════════════════════════
-- CRM Automation — Schema SQL para Supabase (PostgreSQL)
-- ═══════════════════════════════════════════════════════════════
-- Execute este arquivo no SQL Editor do Supabase Dashboard
-- ou via CLI: supabase db push
-- ═══════════════════════════════════════════════════════════════

-- Habilita a extensão UUID (já vem ativa no Supabase, mas por garantia)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- Tipo ENUM para intenção do lead
-- Garante consistência nos dados em nível de banco
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE lead_intent AS ENUM ('VENDAS', 'SUPORTE', 'OUTROS');
EXCEPTION
  WHEN duplicate_object THEN NULL; -- Ignora se já existir
END $$;

-- ─────────────────────────────────────────────
-- Tabela principal: leads
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100)  NOT NULL,
  message     TEXT          NOT NULL,
  intent      lead_intent   NOT NULL DEFAULT 'OUTROS',
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Constraints de negócio
  CONSTRAINT leads_name_length    CHECK (char_length(name) >= 2),
  CONSTRAINT leads_message_length CHECK (char_length(message) >= 5)
);

-- ─────────────────────────────────────────────
-- Índices para consultas frequentes
-- ─────────────────────────────────────────────

-- Listagem por data (padrão da API)
CREATE INDEX IF NOT EXISTS idx_leads_created_at
  ON leads (created_at DESC);

-- Filtro por intenção
CREATE INDEX IF NOT EXISTS idx_leads_intent
  ON leads (intent);

-- Busca por nome (ilike usa índice com pg_trgm)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_leads_name_trgm
  ON leads USING GIN (name gin_trgm_ops);

-- ─────────────────────────────────────────────
-- Row Level Security (RLS)
-- Supabase exige RLS ativado em produção
-- ─────────────────────────────────────────────
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Política: service_role tem acesso total (backend usa service_role key)
CREATE POLICY "service_role_all" ON leads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Política: anon pode apenas ler (ajuste conforme necessidade)
-- Para bloquear totalmente o acesso anônimo, não crie esta política
CREATE POLICY "anon_read" ON leads
  FOR SELECT
  TO anon
  USING (true);

-- ─────────────────────────────────────────────
-- Dados de exemplo para testes
-- ─────────────────────────────────────────────
INSERT INTO leads (name, message, intent) VALUES
  ('João Silva',   'Olá, gostaria de saber o preço do plano Pro', 'VENDAS'),
  ('Maria Santos', 'Não estou conseguindo fazer login no sistema', 'SUPORTE'),
  ('Carlos Lima',  'Quero uma demonstração do produto para minha empresa', 'VENDAS'),
  ('Ana Costa',    'Meu relatório está dando erro desde ontem', 'SUPORTE'),
  ('Pedro Alves',  'Só estou explorando o sistema, obrigado', 'OUTROS')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- View auxiliar: resumo por intenção (útil para dashboards)
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW leads_summary AS
SELECT
  intent,
  COUNT(*)                                    AS total,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS last_7_days,
  MAX(created_at)                             AS last_lead_at
FROM leads
GROUP BY intent;

-- Verificação final
SELECT 'Schema criado com sucesso!' AS status, COUNT(*) AS total_leads FROM leads;
