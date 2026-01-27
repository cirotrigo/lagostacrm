'use client';

/**
 * Client Extensions System
 *
 * Sistema para carregar extensões específicas de clientes de forma lazy.
 * Evita importar código de clientes no bundle do core.
 *
 * @example
 * ```tsx
 * import { useClientExtension, ClientExtensionSlot } from '@/lib/client-extensions';
 *
 * // Opção 1: Hook
 * const ProductsToolbar = useClientExtension('products-toolbar');
 * if (ProductsToolbar) return <ProductsToolbar {...props} />;
 *
 * // Opção 2: Componente declarativo
 * <ClientExtensionSlot name="products-toolbar" props={{ onComplete: reload }} />
 * ```
 */

import React, { lazy, Suspense, useMemo, type ComponentType } from 'react';
import { getClientId, isClient } from './client';

/**
 * Slots de extensão disponíveis
 */
export type ExtensionSlot =
  | 'products-toolbar'       // Toolbar extra na página de produtos
  | 'products-actions'       // Ações extras em cada produto
  | 'deal-sidebar'           // Sidebar extra no deal
  | 'settings-tab';          // Tab extra em configurações

/**
 * Registry de extensões por cliente
 * Usa lazy loading para não incluir código desnecessário no bundle
 */
const EXTENSION_REGISTRY: Record<string, Partial<Record<ExtensionSlot, () => Promise<{ default: ComponentType<unknown> }>>>> = {
  jucaocrm: {
    'products-toolbar': () => import('@/clients/jucaocrm/features/import-xlsx/ui/ProductsToolbarExtension'),
  },
  // lagostacrm: { ... },
  // Outros clientes podem ser adicionados aqui
};

/**
 * Retorna o componente de extensão para o slot especificado (se existir)
 *
 * @param slot - Slot de extensão
 * @returns Componente lazy ou null se não existir
 */
export function getClientExtension(slot: ExtensionSlot): ComponentType<unknown> | null {
  const clientId = getClientId();
  const clientExtensions = EXTENSION_REGISTRY[clientId];

  if (!clientExtensions?.[slot]) {
    return null;
  }

  return lazy(clientExtensions[slot]!);
}

/**
 * Hook para obter extensão do cliente atual
 *
 * @param slot - Slot de extensão
 * @returns Componente lazy ou null
 *
 * @example
 * ```tsx
 * const ToolbarExtension = useClientExtension('products-toolbar');
 * return ToolbarExtension ? <ToolbarExtension {...props} /> : null;
 * ```
 */
export function useClientExtension(slot: ExtensionSlot): ComponentType<unknown> | null {
  return useMemo(() => getClientExtension(slot), [slot]);
}

/**
 * Props do componente ClientExtensionSlot
 */
interface ClientExtensionSlotProps {
  /**
   * Nome do slot de extensão
   */
  name: ExtensionSlot;

  /**
   * Props a serem passadas para o componente de extensão
   */
  props?: Record<string, unknown>;

  /**
   * Componente de fallback durante carregamento
   */
  fallback?: React.ReactNode;

  /**
   * Classe CSS para o wrapper
   */
  className?: string;
}

/**
 * Componente declarativo para renderizar extensões de cliente
 *
 * Renderiza automaticamente a extensão do cliente atual para o slot especificado.
 * Se não houver extensão, não renderiza nada.
 *
 * @example
 * ```tsx
 * <ClientExtensionSlot
 *   name="products-toolbar"
 *   props={{ onImportComplete: reload, disabled: loading }}
 * />
 * ```
 */
export const ClientExtensionSlot: React.FC<ClientExtensionSlotProps> = ({
  name,
  props = {},
  fallback = null,
  className,
}) => {
  const Extension = useClientExtension(name);

  if (!Extension) {
    return null;
  }

  return (
    <Suspense fallback={fallback}>
      <div className={className}>
        <Extension {...props} />
      </div>
    </Suspense>
  );
};

/**
 * Verifica se existe uma extensão para o slot no cliente atual
 *
 * @param slot - Slot de extensão
 * @returns true se existe extensão
 */
export function hasClientExtension(slot: ExtensionSlot): boolean {
  const clientId = getClientId();
  return !!EXTENSION_REGISTRY[clientId]?.[slot];
}

/**
 * Verifica se a feature está habilitada para o cliente atual
 * Combina checagem de cliente + config de feature
 *
 * @param featureName - Nome da feature (ex: 'xlsxImport')
 * @returns true se habilitada
 */
export function isFeatureEnabled(featureName: string): boolean {
  // JucãoCRM features
  if (isClient('jucaocrm')) {
    // Importar config do cliente dinamicamente seria ideal,
    // mas para simplicidade, hardcode por enquanto
    const jucaoFeatures: Record<string, boolean> = {
      xlsxImport: true,
      customBranding: false,
    };
    return jucaoFeatures[featureName] ?? false;
  }

  return false;
}

export default ClientExtensionSlot;
