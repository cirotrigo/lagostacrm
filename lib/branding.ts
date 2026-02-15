/**
 * Branding Configuration
 *
 * Sistema de branding com 2 camadas:
 * 1. Banco de dados (organization_settings) — fonte primária para produção
 * 2. CLIENT_ID (env var) — fallback para dev/staging ou quando o banco não tem branding configurado
 *
 * @example
 * ```typescript
 * // Server Component ou API Route (com acesso ao Supabase)
 * import { getBrandingFromDb } from '@/lib/branding';
 * const brand = await getBrandingFromDb(supabase, organizationId);
 *
 * // Client Component ou contexto sem Supabase
 * import { getBranding } from '@/lib/branding';
 * const brand = getBranding(); // usa CLIENT_ID como fallback
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
  /** Nome curto (para mobile/PWA) */
  shortName: string;
  /** Inicial para o logo gerado */
  initial: string;
  /** Descrição para SEO e manifest */
  description: string;
  /** Cor primária (hex, ex: #16a34a) */
  primaryColor?: string;
  /** URL do logo customizado */
  logoUrl?: string;
}

/**
 * Configurações de branding estáticas por CLIENT_ID (fallback)
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
 * Retorna branding estático baseado no CLIENT_ID (env var)
 * Usado como fallback quando não há Supabase disponível
 */
export function getBranding(): BrandConfig {
  const clientId = getClientId();
  return BRAND_CONFIG[clientId] ?? BRAND_CONFIG.default;
}

/**
 * Busca branding dinâmico do banco de dados (organization_settings)
 * Se não encontrar dados de branding no banco, usa fallback do CLIENT_ID
 *
 * @param supabase - Client do Supabase autenticado
 * @param organizationId - UUID da organização (opcional, resolve via profile se não fornecido)
 * @returns BrandConfig com dados do banco ou fallback
 */
export async function getBrandingFromDb(
  supabase: SupabaseClient,
  organizationId?: string
): Promise<BrandConfig> {
  try {
    // Se não recebeu organizationId, resolver via profile do usuário logado
    let orgId = organizationId;
    if (!orgId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .single();
        orgId = profile?.organization_id;
      }
    }

    if (!orgId) {
      return getBranding(); // fallback
    }

    const { data: settings } = await supabase
      .from('organization_settings')
      .select('brand_name, brand_short_name, brand_logo_url, brand_primary_color, brand_description')
      .eq('organization_id', orgId)
      .maybeSingle();

    // Se tem brand_name configurado no banco, usar dados do banco
    if (settings?.brand_name) {
      return {
        name: settings.brand_name,
        shortName: settings.brand_short_name || settings.brand_name,
        initial: settings.brand_name[0]?.toUpperCase() || 'N',
        description: settings.brand_description || `CRM - ${settings.brand_name}`,
        primaryColor: settings.brand_primary_color || undefined,
        logoUrl: settings.brand_logo_url || undefined,
      };
    }

    // Fallback: CLIENT_ID (env var)
    return getBranding();
  } catch {
    // Em caso de erro (ex: tabela não migrada ainda), fallback silencioso
    return getBranding();
  }
}

/**
 * Helpers de conveniência (mantidos para retrocompatibilidade)
 */
export function getBrandName(): string {
  return getBranding().name;
}

export function getBrandInitial(): string {
  return getBranding().initial;
}

export function getBrandDescription(): string {
  return getBranding().description;
}
