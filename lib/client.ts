/**
 * Client Detection Mechanism
 *
 * Sistema para identificar e carregar customizações específicas de clientes
 * baseado na variável de ambiente CLIENT_ID.
 *
 * @example
 * ```typescript
 * import { getClientId, isClient } from '@/lib/client';
 *
 * // Verificar cliente ativo
 * if (isClient('jucaocrm')) {
 *   // Código específico do JucãoCRM
 * }
 *
 * // Obter ID do cliente
 * const clientId = getClientId(); // 'jucaocrm' | 'lagostacrm' | 'default'
 * ```
 */

export type ClientId = 'jucaocrm' | 'lagostacrm' | 'default';

/**
 * Lista de clientes suportados
 */
export const SUPPORTED_CLIENTS: ClientId[] = ['jucaocrm', 'lagostacrm', 'default'];

/**
 * Retorna o CLIENT_ID atual baseado na variável de ambiente
 * Fallback para 'lagostacrm' neste fork dedicado
 */
export function getClientId(): ClientId {
  const clientId = process.env.CLIENT_ID || process.env.NEXT_PUBLIC_CLIENT_ID;

  if (clientId && SUPPORTED_CLIENTS.includes(clientId as ClientId)) {
    return clientId as ClientId;
  }

  // Este fork é dedicado ao LagostaCRM (CRM Coronel)
  return 'lagostacrm';
}

/**
 * Verifica se o cliente atual é o especificado
 *
 * @param clientId - ID do cliente para verificar
 * @returns true se o cliente atual corresponde ao especificado
 */
export function isClient(clientId: ClientId): boolean {
  return getClientId() === clientId;
}

/**
 * Verifica se está rodando como JucãoCRM
 */
export function isJucaoCRM(): boolean {
  return isClient('jucaocrm');
}

/**
 * Verifica se está rodando como LagostaCRM
 */
export function isLagostaCRM(): boolean {
  return isClient('lagostacrm');
}

/**
 * Retorna configuração específica do cliente se existir, ou fallback
 *
 * @param configs - Objeto com configurações por cliente
 * @returns Configuração do cliente atual ou default
 */
export function getClientConfig<T>(configs: Partial<Record<ClientId, T>> & { default: T }): T {
  const clientId = getClientId();
  return configs[clientId] ?? configs.default;
}
