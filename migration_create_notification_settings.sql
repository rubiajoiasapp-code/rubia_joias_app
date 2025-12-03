-- Migration: Criar tabela de configurações de notificações WhatsApp
-- Data: 2024-12-03

-- Tabela para armazenar configurações de lembretes WhatsApp
CREATE TABLE IF NOT EXISTS configuracoes_notificacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  whatsapp_numero TEXT NOT NULL,
  callmebot_api_key TEXT NOT NULL,
  horario_envio TIME DEFAULT '10:00:00',
  dias_antecedencia INTEGER[] DEFAULT ARRAY[3, 2, 0], -- 3 dias antes, 2 dias antes, dia do vencimento
  ativo BOOLEAN DEFAULT true,
  enviar_finais_semana BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para buscar configuração ativa
CREATE INDEX IF NOT EXISTS idx_configuracoes_ativo 
  ON configuracoes_notificacoes(ativo) 
  WHERE ativo = true;

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_configuracoes_notificacoes_updated_at
    BEFORE UPDATE ON configuracoes_notificacoes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Inserir configuração padrão (será atualizada pelo usuário)
INSERT INTO configuracoes_notificacoes (
  whatsapp_numero,
  callmebot_api_key,
  horario_envio,
  dias_antecedencia,
  ativo
) VALUES (
  '5500000000000', -- Placeholder - usuário deve atualizar
  'YOUR_API_KEY_HERE', -- Placeholder - usuário deve atualizar
  '10:00:00',
  ARRAY[3, 2, 0],
  false -- Desativado por padrão até configurar
) ON CONFLICT DO NOTHING;

-- Comentários nas colunas
COMMENT ON TABLE configuracoes_notificacoes IS 'Configurações para envio de lembretes automáticos via WhatsApp';
COMMENT ON COLUMN configuracoes_notificacoes.whatsapp_numero IS 'Número WhatsApp com DDI (ex: 5511999999999)';
COMMENT ON COLUMN configuracoes_notificacoes.callmebot_api_key IS 'Chave API fornecida pelo CallMeBot';
COMMENT ON COLUMN configuracoes_notificacoes.horario_envio IS 'Horário do dia para envio dos lembretes';
COMMENT ON COLUMN configuracoes_notificacoes.dias_antecedencia IS 'Array com dias de antecedência para alertar (ex: [3,2,0] = 3 dias antes, 2 dias antes, no dia)';
COMMENT ON COLUMN configuracoes_notificacoes.ativo IS 'Se os lembretes automáticos estão ativos';
COMMENT ON COLUMN configuracoes_notificacoes.enviar_finais_semana IS 'Se deve enviar lembretes em sábados e domingos';
