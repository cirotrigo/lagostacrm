-- =============================================================================
-- Auto-Tag Deal on Stage Change
-- LagostaCRM - Sincronizacao WhatsApp Labels
-- Migration: 20260213000000_deal_stage_auto_tag.sql
-- =============================================================================
--
-- Quando um deal muda de etapa, este trigger:
-- 1. REMOVE a tag da etapa anterior
-- 2. ADICIONA a tag da nova etapa (deal tem apenas UMA tag de etapa)
-- 3. Garante que a tag exista na tabela tags com cor correspondente
--
-- Executado BEFORE UPDATE para que o webhook outbound (AFTER UPDATE)
-- ja veja os dados atualizados.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Funcao: add_stage_tag_to_deal
-- Substitui a tag da etapa no deal quando muda de stage (apenas uma tag por vez)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_stage_tag_to_deal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stage_label TEXT;
  old_stage_label TEXT;
  stage_color TEXT;
  -- Lista de todas as tags de etapa (para remover a anterior)
  v_stage_tags TEXT[] := ARRAY[
    'Nova Interacao', 'Nova Interação',
    'Em Atendimento',
    'Aguardando Cliente',
    'Informacoes Fornecidas', 'Informações Fornecidas', 'Info Fornecidas',
    'Direcionado para Canal Oficial', 'Canal Oficial',
    'Finalizado'
  ];
  -- Mapeamento de cores por etapa (cores do WhatsApp Business)
  v_stage_colors JSONB := '{
    "Nova Interacao": "#9E9E9E",
    "Nova Interação": "#9E9E9E",
    "Em Atendimento": "#4CAF50",
    "Aguardando Cliente": "#FFC107",
    "Informacoes Fornecidas": "#2196F3",
    "Informações Fornecidas": "#2196F3",
    "Info Fornecidas": "#2196F3",
    "Direcionado para Canal Oficial": "#9C27B0",
    "Canal Oficial": "#9C27B0",
    "Finalizado": "#607D8B"
  }'::jsonb;
  tag_to_remove TEXT;
BEGIN
  -- So executa se stage_id mudou
  IF NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN
    RETURN NEW;
  END IF;

  -- Busca o nome da nova etapa
  SELECT label INTO stage_label
  FROM public.board_stages
  WHERE id = NEW.stage_id;

  IF stage_label IS NOT NULL THEN
    -- Resolve a cor do mapeamento (default cinza)
    stage_color := COALESCE(v_stage_colors ->> stage_label, '#9E9E9E');

    -- Garante que a tag exista na tabela tags
    INSERT INTO public.tags (name, color, organization_id)
    VALUES (stage_label, stage_color, NEW.organization_id)
    ON CONFLICT (name, organization_id) DO NOTHING;

    -- REMOVE todas as tags de etapa antigas do array
    FOREACH tag_to_remove IN ARRAY v_stage_tags LOOP
      NEW.tags := array_remove(COALESCE(NEW.tags, '{}'), tag_to_remove);
    END LOOP;

    -- ADICIONA apenas a tag da nova etapa
    NEW.tags := array_append(NEW.tags, stage_label);
  END IF;

  RETURN NEW;
END;
$$;

-- Comentario da funcao
COMMENT ON FUNCTION public.add_stage_tag_to_deal() IS
'Substitui a tag da etapa no deal quando muda de stage.
Remove a tag da etapa anterior e adiciona apenas a tag da nova etapa.
O deal sempre tem apenas UMA tag de etapa (permite filtrar por status atual).
Tambem garante que a tag exista na tabela tags com cor correspondente.
Usado para sincronizacao com labels do WhatsApp Business.';

-- -----------------------------------------------------------------------------
-- Trigger: trg_add_stage_tag_to_deal
-- Executa ANTES do UPDATE para que o webhook outbound veja dados atualizados
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_add_stage_tag_to_deal ON public.deals;
CREATE TRIGGER trg_add_stage_tag_to_deal
BEFORE UPDATE ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.add_stage_tag_to_deal();

-- Comentario do trigger
COMMENT ON TRIGGER trg_add_stage_tag_to_deal ON public.deals IS
'Trigger BEFORE UPDATE que adiciona tag da etapa ao deal.
Executa antes do trg_notify_deal_stage_changed para garantir consistencia.';

-- -----------------------------------------------------------------------------
-- Verificacao: Garantir que tags existentes no sistema estejam no mapeamento
-- Este bloco cria as tags padrao caso nao existam
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_org_id UUID;
  v_default_tags TEXT[][] := ARRAY[
    ARRAY['Nova Interacao', '#9E9E9E'],
    ARRAY['Em Atendimento', '#4CAF50'],
    ARRAY['Aguardando Cliente', '#FFC107'],
    ARRAY['Informacoes Fornecidas', '#2196F3'],
    ARRAY['Info Fornecidas', '#2196F3'],
    ARRAY['Direcionado para Canal Oficial', '#9C27B0'],
    ARRAY['Canal Oficial', '#9C27B0'],
    ARRAY['Finalizado', '#607D8B']
  ];
  tag_pair TEXT[];
BEGIN
  -- Para cada organizacao existente, criar as tags padrao
  FOR v_org_id IN SELECT DISTINCT id FROM public.organizations LOOP
    FOREACH tag_pair SLICE 1 IN ARRAY v_default_tags LOOP
      INSERT INTO public.tags (name, color, organization_id)
      VALUES (tag_pair[1], tag_pair[2], v_org_id)
      ON CONFLICT (name, organization_id) DO NOTHING;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Tags padrao de etapas criadas para todas as organizacoes';
END;
$$;
