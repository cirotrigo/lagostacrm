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

// Constants
export {
  EXPECTED_HEADERS,
  POSITIONAL_COLUMN_INDEXES,
  PROCESSADO_HEADER,
  COLUMN_MAPPING,
  HEADER_INDEX,
  REQUIRED_FIELDS,
  OPTIONAL_FIELDS,
  type ProductField,
  type ExpectedHeader,
} from './constants';

// Normalizers
export {
  normalizeCell,
  normalizeRowCell,
  normalizeHeaderLabel,
  hasValue,
  normalizePrice,
  normalizeSku,
  findBestHeaderMatch,
  detectFieldFromHeader,
  buildExpectedHeaderMap,
} from './parser/normalizers';

// Parser
export {
  parseImportXlsxBuffer,
  parseImportXlsx,
  parseXlsxToProducts,
  convertToProducts,
  isValidXlsxFile,
  type ParsedSheet,
  type ParsedProducts,
} from './parser/parseXlsx';

// Services
export {
  importProductsFromXlsx,
  importProductsWithDedup,
  checkSkuExists,
} from './services/importProductsFromXlsx';

export { importJobService } from './services/importJobService';
export { stagingService } from './services/stagingService';
export { webhookService, type WebhookPayload, type WebhookResponse } from './services/webhookService';

// UI Components
export { ImportProductsButton } from './ui/ImportProductsButton';
export { default as ImportProductsButtonDefault } from './ui/ImportProductsButton';
export { ImportProgressCard } from './ui/ImportProgressCard';
export { ProductsToolbarExtension } from './ui/ProductsToolbarExtension';

/**
 * Feature metadata
 */
export const IMPORT_XLSX_FEATURE = {
  id: 'import-xlsx',
  name: 'Importação XLSX',
  description: 'Importar produtos de planilhas Excel (.xlsx)',
  version: '1.0.0',
  status: 'stable' as const,
} as const;
