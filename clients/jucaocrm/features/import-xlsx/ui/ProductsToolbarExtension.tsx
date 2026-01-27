'use client';

/**
 * Products Toolbar Extension
 *
 * Extensão de toolbar para a página de produtos.
 * Renderiza ações extras específicas do cliente JucãoCRM.
 *
 * Este componente é importado condicionalmente no ProductsCatalogManager
 * baseado na configuração do cliente.
 */

import React from 'react';
import { ImportProductsButton } from './ImportProductsButton';
import type { ImportResult } from '../types';

interface ProductsToolbarExtensionProps {
  /**
   * Callback chamado após importação bem-sucedida
   */
  onImportComplete?: (result: ImportResult) => void;

  /**
   * Desabilitar todas as ações
   */
  disabled?: boolean;
}

/**
 * Toolbar com ações extras para produtos (JucãoCRM)
 *
 * @example
 * ```tsx
 * // No ProductsCatalogManager, condicionalmente:
 * {isJucaoCRM && <ProductsToolbarExtension onImportComplete={reload} />}
 * ```
 */
export const ProductsToolbarExtension: React.FC<ProductsToolbarExtensionProps> = ({
  onImportComplete,
  disabled = false,
}) => {
  return (
    <div className="flex items-center gap-2">
      <ImportProductsButton
        onImportComplete={onImportComplete}
        disabled={disabled}
        variant="secondary"
      />
    </div>
  );
};

export default ProductsToolbarExtension;
