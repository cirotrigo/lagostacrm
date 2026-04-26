-- =============================================================================
-- Migration: 20260425020000_separate_reservation_hours.sql
-- Separa horário de funcionamento (informacional) de horário de aceitação
-- de reservas (funcional).
--
-- Antes: scheduling_operating_hours era usado pra ambas semânticas — fazia
-- a reserva inteira (start+end) ter que caber dentro. Resultado: reserva
-- 19h não funcionava se hours=11h-20h, mesmo que o restaurante estivesse
-- aberto até mais tarde.
--
-- Depois:
--   scheduling_operating_hours = quando restaurante ESTÁ ABERTO. End da
--     reserva precisa caber aqui.
--   scheduling_reservation_hours = quando aceita registrar RESERVAS via
--     agente. Start da reserva precisa caber aqui.
--
-- Migração de dados: copia o valor atual de operating_hours para
-- reservation_hours (preserva a configuração que os usuários fizeram
-- pensando em reservation_hours).
-- =============================================================================

ALTER TABLE public.organization_settings
    ADD COLUMN IF NOT EXISTS scheduling_reservation_hours JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.organization_settings.scheduling_operating_hours IS 'Horário em que o restaurante ESTÁ ABERTO (informacional + bound do end da reserva). Schema: { monday: { open: bool, intervals: [{start, end}] }, ... }';
COMMENT ON COLUMN public.organization_settings.scheduling_reservation_hours IS 'Horário em que aceita registrar RESERVAS via agente (bound do start da reserva). Mesmo schema. Vazio = usa scheduling_operating_hours como fallback.';

-- Copia o valor atual (que estava sendo usado como reservation_hours) para o campo novo.
-- Não toca em scheduling_operating_hours — o usuário vai atualizar via UI.
UPDATE public.organization_settings
SET scheduling_reservation_hours = scheduling_operating_hours
WHERE scheduling_operating_hours <> '{}'::jsonb
  AND scheduling_reservation_hours = '{}'::jsonb;
