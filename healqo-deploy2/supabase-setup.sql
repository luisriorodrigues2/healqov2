-- ============================================
-- Healqo v2 — Supabase Setup
-- Colar no SQL Editor do Supabase e clicar "Run"
-- ============================================

-- 1. Criar tabela
CREATE TABLE IF NOT EXISTS app_data (
  id INTEGER PRIMARY KEY DEFAULT 1,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Inserir linha inicial (ignora se já existir)
INSERT INTO app_data (id, data)
VALUES (1, '{}')
ON CONFLICT (id) DO NOTHING;

-- 3. Ativar Row Level Security
ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;

-- 4. Permitir acesso com a anon key
CREATE POLICY "Allow all access" ON app_data
  FOR ALL USING (true) WITH CHECK (true);
