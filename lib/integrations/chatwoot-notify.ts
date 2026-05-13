/**
 * Notificação de cliente via Chatwoot API.
 *
 * Usado para enviar mensagens automáticas ao cliente quando uma reserva é
 * aprovada ou rejeitada manualmente pela equipe. Lê as credenciais por
 * organização em `messaging_channel_configs` e respeita o canal (whatsapp/instagram).
 */

import { createStaticAdminClient } from '@/lib/supabase/server';

export type ChannelType = 'whatsapp' | 'instagram';

export type ChannelConfig = {
  id: string;
  organization_id: string;
  chatwoot_base_url: string;
  chatwoot_api_token: string;
  chatwoot_account_id: number;
  chatwoot_inbox_id: number;
  channel_type: ChannelType | string;
  status: string | null;
};

export type NotifyResult =
  | { ok: true; conversationId: number; messageId?: number }
  | { ok: false; reason: 'no_config' | 'no_conversation' | 'send_failed' | 'no_phone' | 'invalid_channel'; detail?: string };

/**
 * Renderiza um template com placeholders `{nome}`, `{data}`, `{hora}`, `{pessoas}`, `{motivo}`.
 * Placeholders não substituídos são removidos (string vazia).
 */
export function renderTemplate(template: string, vars: Record<string, string | number | undefined | null>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

/**
 * Busca a config de canal ativa pra organização.
 * Prefere o canal informado; se não vier, retorna o primeiro whatsapp ativo, depois instagram.
 */
export async function loadChannelConfig(
  organizationId: string,
  preferredChannel?: ChannelType,
): Promise<ChannelConfig | null> {
  const sb = createStaticAdminClient();
  const { data } = await sb
    .from('messaging_channel_configs')
    .select('id, organization_id, chatwoot_base_url, chatwoot_api_token, chatwoot_account_id, chatwoot_inbox_id, channel_type, status')
    .eq('organization_id', organizationId)
    .eq('status', 'active');
  const rows = (data ?? []) as ChannelConfig[];
  if (rows.length === 0) return null;
  if (preferredChannel) {
    const preferred = rows.find((r) => r.channel_type === preferredChannel);
    if (preferred) return preferred;
  }
  // Default: whatsapp > instagram > primeiro
  return (
    rows.find((r) => r.channel_type === 'whatsapp') ??
    rows.find((r) => r.channel_type === 'instagram') ??
    rows[0]
  );
}

/** Envia uma mensagem outgoing em uma conversa existente. */
export async function sendChatwootMessage(
  config: ChannelConfig,
  conversationId: number,
  content: string,
): Promise<{ ok: true; messageId: number } | { ok: false; detail: string }> {
  const url = `${config.chatwoot_base_url.replace(/\/$/, '')}/api/v1/accounts/${config.chatwoot_account_id}/conversations/${conversationId}/messages`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        api_access_token: config.chatwoot_api_token,
      },
      body: JSON.stringify({ content, message_type: 'outgoing', private: false }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, detail: `HTTP ${res.status}: ${json?.message || JSON.stringify(json)}` };
    }
    return { ok: true, messageId: Number(json?.id) || 0 };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'fetch_error' };
  }
}

/**
 * Procura a última conversa aberta do contato em um inbox específico.
 * Útil quando a reserva foi criada manualmente sem conversation_id explícito.
 */
export async function findOpenConversationByPhone(
  config: ChannelConfig,
  phoneE164: string,
): Promise<number | null> {
  const baseUrl = config.chatwoot_base_url.replace(/\/$/, '');
  const params = new URLSearchParams({
    q: phoneE164,
    include_contact_inboxes: 'false',
  });
  try {
    // Chatwoot search contacts API
    const searchUrl = `${baseUrl}/api/v1/accounts/${config.chatwoot_account_id}/contacts/search?${params.toString()}`;
    const sRes = await fetch(searchUrl, {
      headers: { api_access_token: config.chatwoot_api_token },
    });
    if (!sRes.ok) return null;
    const sJson = await sRes.json().catch(() => ({}));
    const contact = Array.isArray(sJson?.payload)
      ? sJson.payload.find((c: any) => c?.phone_number === phoneE164) || sJson.payload[0]
      : null;
    if (!contact?.id) return null;

    // Get contact conversations
    const convsUrl = `${baseUrl}/api/v1/accounts/${config.chatwoot_account_id}/contacts/${contact.id}/conversations`;
    const cRes = await fetch(convsUrl, {
      headers: { api_access_token: config.chatwoot_api_token },
    });
    if (!cRes.ok) return null;
    const cJson = await cRes.json().catch(() => ({}));
    const conversations: any[] = cJson?.payload ?? [];
    // Prefer same inbox + open/pending
    const inInbox = conversations.filter((c) => c?.inbox_id === config.chatwoot_inbox_id);
    const open = inInbox.find((c) => c?.status === 'open' || c?.status === 'pending');
    if (open?.id) return Number(open.id);
    // Fallback: last conversation in this inbox
    const last = inInbox[0];
    return last?.id ? Number(last.id) : null;
  } catch {
    return null;
  }
}

export type ReservationNotifyInput = {
  organizationId: string;
  message: string;
  conversationId?: number | null;
  preferredChannel?: ChannelType;
  /** Telefone E.164 (+5527...) usado pra lookup quando não há conversationId */
  contactPhone?: string | null;
};

/**
 * Orquestrador: tenta enviar mensagem na conversa fornecida.
 * Se não houver conversationId, faz lookup pela telefone do contato no canal padrão.
 */
export async function notifyReservationCustomer(input: ReservationNotifyInput): Promise<NotifyResult> {
  const config = await loadChannelConfig(input.organizationId, input.preferredChannel);
  if (!config) return { ok: false, reason: 'no_config' };

  let conversationId = input.conversationId ?? null;
  if (!conversationId) {
    if (!input.contactPhone) return { ok: false, reason: 'no_phone' };
    conversationId = await findOpenConversationByPhone(config, input.contactPhone);
    if (!conversationId) return { ok: false, reason: 'no_conversation' };
  }

  const send = await sendChatwootMessage(config, conversationId, input.message);
  if (!send.ok) return { ok: false, reason: 'send_failed', detail: send.detail };
  return { ok: true, conversationId, messageId: send.messageId };
}

export const DEFAULT_APPROVE_TEMPLATE =
  'Boas notícias, {nome}! Sua reserva para {data} às {hora} para {pessoas} pessoa(s) foi confirmada. Te esperamos! 🍷';

export const DEFAULT_REJECT_TEMPLATE =
  'Olá, {nome}. Infelizmente não consegui confirmar sua reserva para {data} às {hora}. Motivo: {motivo}. Posso te ajudar a buscar outro horário? 😊';
