-- =============================================================================
-- Migration: 20260425000000_scheduling_config.sql
-- Configuração de agendamento de reservas por organização
--
-- Adiciona:
-- 1. Colunas scheduling_* em organization_settings (config por tenant)
-- 2. Coluna metadata jsonb em activities (party_size, duration_minutes, status)
-- 3. Índice GIN em activities.metadata para queries de capacidade
-- =============================================================================

-- 1. organization_settings: config de reservas
ALTER TABLE public.organization_settings
    ADD COLUMN IF NOT EXISTS scheduling_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS scheduling_max_advance_days INTEGER NOT NULL DEFAULT 30,
    ADD COLUMN IF NOT EXISTS scheduling_min_advance_minutes INTEGER NOT NULL DEFAULT 90,
    ADD COLUMN IF NOT EXISTS scheduling_default_capacity INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS scheduling_slot_duration_minutes INTEGER NOT NULL DEFAULT 120,
    ADD COLUMN IF NOT EXISTS scheduling_slot_step_minutes INTEGER NOT NULL DEFAULT 30,
    ADD COLUMN IF NOT EXISTS scheduling_operating_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS scheduling_blocked_dates JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS scheduling_areas JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.organization_settings.scheduling_enabled IS 'Liga/desliga a feature de agendamento de reservas para o tenant';
COMMENT ON COLUMN public.organization_settings.scheduling_max_advance_days IS 'Antecedência máxima em dias para registrar uma reserva';
COMMENT ON COLUMN public.organization_settings.scheduling_min_advance_minutes IS 'Antecedência mínima em minutos para registrar uma reserva';
COMMENT ON COLUMN public.organization_settings.scheduling_default_capacity IS 'Capacidade total quando não há áreas configuradas (modo single-area)';
COMMENT ON COLUMN public.organization_settings.scheduling_slot_duration_minutes IS 'Duração default da reserva em minutos';
COMMENT ON COLUMN public.organization_settings.scheduling_slot_step_minutes IS 'Granularidade dos slots (30 = 19h, 19h30, 20h...)';
COMMENT ON COLUMN public.organization_settings.scheduling_operating_hours IS 'Horário de funcionamento por dia da semana. Schema: { monday: { open: bool, intervals: [{start, end}] }, ... }';
COMMENT ON COLUMN public.organization_settings.scheduling_blocked_dates IS 'Datas bloqueadas. Schema: [{ date, reason, mode: first_come|closed, message }]';
COMMENT ON COLUMN public.organization_settings.scheduling_areas IS 'Áreas com capacidade individual. Schema: [{ id, name, capacity }]. Vazio = single area usando scheduling_default_capacity';

-- 2. activities: metadata para reservas
ALTER TABLE public.activities
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.activities.metadata IS 'Dados adicionais. Para reservas: { party_size, duration_minutes, area_id, status: confirmed|canceled|rescheduled|completed }';

-- 3. Índice para queries de capacidade
CREATE INDEX IF NOT EXISTS activities_metadata_gin
    ON public.activities USING gin (metadata);

-- Índice composto para query de overlap de reservas (organization + date + type)
CREATE INDEX IF NOT EXISTS activities_org_type_date_idx
    ON public.activities (organization_id, type, date)
    WHERE deleted_at IS NULL;
