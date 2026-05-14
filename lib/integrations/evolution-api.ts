/**
 * Wrapper para a Evolution API (WhatsApp via Baileys).
 *
 * Lê config por organização da tabela `evolution_instances` e expõe operações:
 * - getStatus: estado atual da instância (open/connecting/close/qrcode)
 * - connect: força conexão e retorna QR Code em base64
 * - disconnect: logout da sessão (apaga sessão local; reconectar requer novo QR)
 * - restart: reinicia a instância sem perder sessão
 *
 * IMPORTANTE: este módulo só roda no backend (usa service role). NUNCA expor
 * a api_key da instância pro frontend.
 */

import { createStaticAdminClient } from '@/lib/supabase/server';

export type EvolutionStatus = 'open' | 'connecting' | 'close' | 'qrcode' | 'unknown';

export type EvolutionInstance = {
  id: string;
  organization_id: string;
  instance_name: string;
  base_url: string;
  api_key: string;
  phone_number: string | null;
  profile_name: string | null;
  profile_picture_url: string | null;
  last_status: EvolutionStatus;
  last_synced_at: string | null;
};

export type EvolutionStatusResponse = {
  state: EvolutionStatus;
  ownerJid: string | null;
  profileName: string | null;
  profilePictureUrl: string | null;
};

export type EvolutionQrResponse = {
  qrBase64: string | null;
  pairingCode: string | null;
  count: number;
};

function buildUrl(instance: EvolutionInstance, path: string): string {
  const base = instance.base_url.replace(/\/$/, '');
  const encodedName = encodeURIComponent(instance.instance_name);
  return `${base}${path.replace('{instance}', encodedName)}`;
}

function headers(instance: EvolutionInstance): HeadersInit {
  return {
    'Content-Type': 'application/json',
    apikey: instance.api_key,
  };
}

/** Carrega a instância configurada pra organização (uma por org). */
export async function loadInstance(organizationId: string): Promise<EvolutionInstance | null> {
  const sb = createStaticAdminClient();
  const { data, error } = await sb
    .from('evolution_instances')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) throw error;
  return (data as EvolutionInstance) ?? null;
}

/** Busca a instância por ID (usado nas chamadas com token público). */
export async function loadInstanceById(id: string): Promise<EvolutionInstance | null> {
  const sb = createStaticAdminClient();
  const { data, error } = await sb
    .from('evolution_instances')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as EvolutionInstance) ?? null;
}

/**
 * Consulta o estado atual via `/instance/fetchInstances?instanceName=X`.
 * Atualiza `last_status` e `last_synced_at` no DB.
 */
export async function getStatus(instance: EvolutionInstance): Promise<EvolutionStatusResponse> {
  const url = `${instance.base_url.replace(/\/$/, '')}/instance/fetchInstances?instanceName=${encodeURIComponent(instance.instance_name)}`;
  const res = await fetch(url, { headers: headers(instance) });
  if (!res.ok) {
    throw new Error(`fetchInstances HTTP ${res.status}: ${await res.text().catch(() => '')}`);
  }
  const data = await res.json();
  const found = Array.isArray(data) ? data.find((x: any) => x?.name === instance.instance_name) ?? data[0] : null;
  const state = ((found?.connectionStatus as EvolutionStatus) || 'unknown') as EvolutionStatus;
  const result: EvolutionStatusResponse = {
    state,
    ownerJid: found?.ownerJid ?? null,
    profileName: found?.profileName ?? null,
    profilePictureUrl: found?.profilePicUrl ?? null,
  };

  // Persist last status
  const sb = createStaticAdminClient();
  await sb
    .from('evolution_instances')
    .update({
      last_status: state,
      profile_name: result.profileName,
      profile_picture_url: result.profilePictureUrl,
      phone_number: result.ownerJid ? result.ownerJid.replace(/@.*/, '') : instance.phone_number,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', instance.id);

  return result;
}

/**
 * Inicia conexão e retorna QR Code em base64. Se o número estiver vinculado
 * e o Evolution suportar, também pode retornar `pairingCode` (código de 8 dígitos).
 */
export async function connect(instance: EvolutionInstance): Promise<EvolutionQrResponse> {
  const url = `${instance.base_url.replace(/\/$/, '')}/instance/connect/${encodeURIComponent(instance.instance_name)}`;
  const res = await fetch(url, { headers: headers(instance) });
  if (!res.ok) {
    throw new Error(`connect HTTP ${res.status}: ${await res.text().catch(() => '')}`);
  }
  const data = await res.json();
  return {
    qrBase64: (data?.base64 as string | undefined) ?? null,
    pairingCode: (data?.pairingCode as string | null | undefined) ?? null,
    count: Number(data?.count ?? 0),
  };
}

/** Logout da sessão (apaga credentials no servidor — exige novo QR pra reconectar). */
export async function disconnect(instance: EvolutionInstance): Promise<void> {
  const url = `${instance.base_url.replace(/\/$/, '')}/instance/logout/${encodeURIComponent(instance.instance_name)}`;
  const res = await fetch(url, { method: 'DELETE', headers: headers(instance) });
  if (!res.ok) {
    throw new Error(`logout HTTP ${res.status}: ${await res.text().catch(() => '')}`);
  }
  const sb = createStaticAdminClient();
  await sb
    .from('evolution_instances')
    .update({ last_status: 'close', last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', instance.id);
}

/** Reinicia a instância sem invalidar sessão existente. */
export async function restart(instance: EvolutionInstance): Promise<void> {
  const url = `${instance.base_url.replace(/\/$/, '')}/instance/restart/${encodeURIComponent(instance.instance_name)}`;
  const res = await fetch(url, { method: 'POST', headers: headers(instance) });
  if (!res.ok) {
    throw new Error(`restart HTTP ${res.status}: ${await res.text().catch(() => '')}`);
  }
}

/** Helper pra construir um path da Evolution API (sem chamar) — útil pra testes. */
export const _internal = { buildUrl, headers };
