-- =============================================================================
-- Migration: 20260425010000_fix_stage_notification_payload.sql
-- Fix: incluir ai_summary no payload do webhook de mudança de stage E
-- disparar também quando ai_summary muda (mesmo sem mudar stage_id).
--
-- Antes: trigger só disparava em mudança de stage_id, e o payload omitia
-- ai_summary — por isso a notificação WhatsApp recebia "Sem resumo".
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_deal_stage_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  endpoint RECORD;
  board_name TEXT;
  from_label TEXT;
  to_label TEXT;
  contact_name TEXT;
  contact_phone TEXT;
  contact_email TEXT;
  payload JSONB;
  event_id UUID;
  delivery_id UUID;
  req_id BIGINT;
BEGIN
  IF (TG_OP <> 'UPDATE') THEN
    RETURN NEW;
  END IF;

  -- Dispara em mudança de stage OU mudança de ai_summary
  IF NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id
     AND NEW.ai_summary IS NOT DISTINCT FROM OLD.ai_summary THEN
    RETURN NEW;
  END IF;

  -- Enriquecimento básico para payload humano
  SELECT b.name INTO board_name FROM public.boards b WHERE b.id = NEW.board_id;
  SELECT bs.label INTO to_label FROM public.board_stages bs WHERE bs.id = NEW.stage_id;
  SELECT bs.label INTO from_label FROM public.board_stages bs WHERE bs.id = OLD.stage_id;

  IF NEW.contact_id IS NOT NULL THEN
    SELECT c.name, c.phone, c.email
      INTO contact_name, contact_phone, contact_email
    FROM public.contacts c
    WHERE c.id = NEW.contact_id;
  END IF;

  FOR endpoint IN
    SELECT * FROM public.integration_outbound_endpoints e
    WHERE e.organization_id = NEW.organization_id
      AND e.active = true
      AND 'deal.stage_changed' = ANY(e.events)
  LOOP
    payload := jsonb_build_object(
      'event_type', 'deal.stage_changed',
      'occurred_at', now(),
      'deal', jsonb_build_object(
        'id', NEW.id,
        'title', NEW.title,
        'value', NEW.value,
        'board_id', NEW.board_id,
        'board_name', board_name,
        'from_stage_id', OLD.stage_id,
        'from_stage_label', from_label,
        'to_stage_id', NEW.stage_id,
        'to_stage_label', to_label,
        'contact_id', NEW.contact_id,
        'ai_summary', NEW.ai_summary,
        'summary_changed', (NEW.ai_summary IS DISTINCT FROM OLD.ai_summary),
        'stage_changed', (NEW.stage_id IS DISTINCT FROM OLD.stage_id)
      ),
      'contact', jsonb_build_object(
        'name', contact_name,
        'phone', contact_phone,
        'email', contact_email
      )
    );

    INSERT INTO public.webhook_events_out (organization_id, event_type, payload, deal_id, from_stage_id, to_stage_id)
    VALUES (NEW.organization_id, 'deal.stage_changed', payload, NEW.id, OLD.stage_id, NEW.stage_id)
    RETURNING id INTO event_id;

    INSERT INTO public.webhook_deliveries (organization_id, endpoint_id, event_id, status)
    VALUES (NEW.organization_id, endpoint.id, event_id, 'queued')
    RETURNING id INTO delivery_id;

    BEGIN
      SELECT net.http_post(
        url := endpoint.url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Webhook-Secret', endpoint.secret,
          'Authorization', ('Bearer ' || endpoint.secret)
        ),
        body := payload
      ) INTO req_id;

      UPDATE public.webhook_deliveries
        SET request_id = req_id
      WHERE id = delivery_id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.webhook_deliveries
        SET status = 'failed',
            error = SQLERRM
      WHERE id = delivery_id;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;
