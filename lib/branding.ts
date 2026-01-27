/**
 * Branding Configuration
 *
 * Configuração de marca dinâmica baseada no CLIENT_ID.
 * Permite personalizar nome, logo e cores por cliente.
 *
 * @example
 * ```typescript
 * import { getBranding } from '@/lib/branding';
 *
 * const brand = getBranding();
 * console.log(brand.name); // 'SosPet', 'LagostaCRM', ou 'NossoCRM'
 * ```
 */

import { getClientId, type ClientId } from './client';

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
}

/**
 * Configurações de branding por cliente
 */
const BRAND_CONFIG: Record<ClientId, BrandConfig> = {
  jucaocrm: {
    name: 'SosPet',
    shortName: 'SosPet',
    initial: 'S',
    description: 'Sistema de Gestão para Pet Shops e Agropecuárias',
  },
  lagostacrm: {
    name: 'LagostaCRM',
    shortName: 'Lagosta',
    initial: 'L',
    description: 'CRM Inteligente para Gestão de Vendas',
  },
  default: {
    name: 'NossoCRM',
    shortName: 'Nosso',
    initial: 'N',
    description: 'CRM Inteligente para Gestão de Vendas',
  },
};

/**
 * Retorna a configuração de branding para o cliente atual
 */
export function getBranding(): BrandConfig {
  const clientId = getClientId();
  return BRAND_CONFIG[clientId] ?? BRAND_CONFIG.default;
}

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
