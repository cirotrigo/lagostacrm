/**
 * Branding Configuration
 *
 * Configuração de marca dinâmica com suporte a múltiplas fontes:
 * 1. Banco de dados (organization_settings) - prioridade máxima para runtime
 * 2. Env vars (NEXT_PUBLIC_BRAND_*) - fallback para primeiro deploy/installer
 * 3. CLIENT_ID hardcoded - fallback legado
 *
 * @example
 * ```typescript
 * // Síncrono (usa env vars ou CLIENT_ID)
 * import { getBranding } from '@/lib/branding';
 * const brand = getBranding();
 *
 * // Async (busca do banco)
 * import { getOrgBranding } from '@/lib/branding';
 * const brand = await getOrgBranding(supabase);
 *
 * // Com settings já carregados (evita query extra)
 * import { getBrandingFromSettings } from '@/lib/branding';
 * const brand = getBrandingFromSettings(orgSettings);
 * ```
 */

import { getClientId, type ClientId } from './client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Configuração de branding por cliente
 */
export interface BrandConfig {
  /** Nome completo da marca */
  name: string;
  /** Nome curto (para mobile) */
  shortName: string;
  /** Inicial para o logo */
  initial: string;
  /** Descrição para SEO */
  description: string;
  /** Cor primária (classe Tailwind ou hex) */
  primaryColor?: string;
  /** URL do logo (storage ou CDN) */
  logoUrl?: string;
  /** URL do favicon */
  faviconUrl?: string;
}

/**
 * Configurações de branding hardcoded por cliente (fallback legado)
 */
const BRAND_CONFIG: Record<ClientId, BrandConfig> = {
  jucaocrm: {
    name: 'SosPet',
    shortName: 'SosPet',
    initial: 'S',
    description: 'Sistema de Gestão para Pet Shops e Agropecuárias',
  },
  lagostacrm: {
    name: 'CRM Coronel',
    shortName: 'Coronel',
    initial: 'C',
    description: 'CRM Inteligente para Gestão de Atendimento',
  },
  default: {
    name: 'NossoCRM',
    shortName: 'Nosso',
    initial: 'N',
    description: 'CRM Inteligente para Gestão de Vendas',
  },
};

/**
 * [SÍNCRONA] Branding via env var ou CLIENT_ID
 *
 * Usar em: app/layout.tsx, app/manifest.ts, e qualquer lugar
 * que não tem acesso a Supabase client (server components sem auth)
 *
 * Prioridade de resolução:
 * 1. NEXT_PUBLIC_BRAND_NAME env var (maior prioridade síncrona)
 * 2. CLIENT_ID → config hardcoded
 * 3. Fallback → 'NossoCRM'
 */
export function getBranding(): BrandConfig {
  // 1. Env var direta (maior prioridade síncrona)
  const envBrand = process.env.NEXT_PUBLIC_BRAND_NAME;
  if (envBrand) {
    return {
      name: envBrand,
      shortName: process.env.NEXT_PUBLIC_BRAND_SHORT_NAME || envBrand,
      initial: process.env.NEXT_PUBLIC_BRAND_INITIAL || envBrand[0],
      description:
        process.env.NEXT_PUBLIC_BRAND_DESCRIPTION || `CRM - ${envBrand}`,
      primaryColor: process.env.NEXT_PUBLIC_BRAND_PRIMARY_COLOR || '#3B82F6',
    };
  }

  // 2. CLIENT_ID hardcoded
  const clientId = getClientId();
  return BRAND_CONFIG[clientId] ?? BRAND_CONFIG.default;
}

/**
 * Tipo das colunas de branding em organization_settings
 */
interface OrgBrandingRow {
  brand_name?: string | null;
  brand_short_name?: string | null;
  brand_initial?: string | null;
  brand_description?: string | null;
  brand_logo_url?: string | null;
  brand_favicon_url?: string | null;
  brand_primary_color?: string | null;
}

/**
 * [ASYNC] Branding via banco de dados (organization_settings)
 *
 * Usar em: componentes server/client que têm acesso a Supabase
 * Faz fallback para getBranding() se não encontrar no banco
 *
 * @param supabase - Cliente Supabase autenticado
 * @returns BrandConfig do banco ou fallback
 */
export async function getOrgBranding(
  supabase: SupabaseClient
): Promise<BrandConfig> {
  try {
    const { data } = await supabase
      .from('organization_settings')
      .select(
        'brand_name, brand_short_name, brand_initial, brand_description, brand_logo_url, brand_favicon_url, brand_primary_color'
      )
      .limit(1)
      .single();

    if (data?.brand_name) {
      return buildBrandConfigFromRow(data);
    }
  } catch {
    // Banco não disponível (installer, primeiro deploy)
    // ou tabela não tem colunas de branding ainda
  }

  return getBranding();
}

/**
 * Branding a partir de settings já carregados (evita query extra)
 *
 * Útil quando o componente já fez fetch de organization_settings
 * e quer extrair branding sem nova query
 *
 * @param settings - Record com colunas de organization_settings
 * @returns BrandConfig do settings ou fallback
 */
export function getBrandingFromSettings(
  settings: Record<string, unknown> | null | undefined
): BrandConfig {
  if (settings?.brand_name && typeof settings.brand_name === 'string') {
    return buildBrandConfigFromRow(settings as unknown as OrgBrandingRow);
  }
  return getBranding();
}

/**
 * Helper interno para construir BrandConfig a partir de uma row do banco
 */
function buildBrandConfigFromRow(row: OrgBrandingRow): BrandConfig {
  const name = row.brand_name || 'NossoCRM';
  return {
    name,
    shortName: row.brand_short_name || name,
    initial: row.brand_initial || name[0],
    description: row.brand_description || `CRM - ${name}`,
    primaryColor: row.brand_primary_color || '#3B82F6',
    logoUrl: row.brand_logo_url || undefined,
    faviconUrl: row.brand_favicon_url || undefined,
  };
}

// ============================================================================
// Exports de conveniência (mantidos para retrocompatibilidade)
// ============================================================================

/**
 * Retorna o nome da marca para o cliente atual
 */
export function getBrandName(): string {
  return getBranding().name;
}

/**
 * Retorna a inicial da marca para o logo
 */
export function getBrandInitial(): string {
  return getBranding().initial;
}

/**
 * Retorna a descrição da marca para SEO
 */
export function getBrandDescription(): string {
  return getBranding().description;
}
