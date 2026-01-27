/**
 * Import XLSX Feature - JucãoCRM
 *
 * Feature para importação de produtos via arquivos XLSX.
 * Código 100% isolado do core.
 *
 * @example
 * ```tsx
 * import { ImportProductsButton } from '@/clients/jucaocrm/features/import-xlsx';
 *
 * // Usar o botão no componente
 * <ImportProductsButton onImportComplete={handleComplete} />
 * ```
 */

// Types
export * from './types';

// Parser
export { parseXlsx, isValidXlsxFile, detectColumnMapping, validateRow } from './parser/parseXlsx';

// Services
export {
  importProductsFromXlsx,
  importProductsWithDedup,
  checkSkuExists,
} from './services/importProductsFromXlsx';

// UI Components
export { ImportProductsButton } from './ui/ImportProductsButton';
export { default as ImportProductsButtonDefault } from './ui/ImportProductsButton';

/**
 * Feature metadata
 */
export const IMPORT_XLSX_FEATURE = {
  id: 'import-xlsx',
  name: 'Importação XLSX',
  description: 'Importar produtos de planilhas Excel (.xlsx)',
  version: '0.1.0',
  status: 'development' as const,
} as const;
