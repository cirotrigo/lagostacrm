/**
 * JucãoCRM Client Entry Point
 *
 * Este módulo exporta todas as customizações do cliente JucãoCRM.
 * Carregado condicionalmente via CLIENT_ID=jucaocrm.
 *
 * @example
 * ```typescript
 * import { JUCAO_CONFIG, ImportProductsButton } from '@/clients/jucaocrm';
 *
 * if (JUCAO_CONFIG.features.xlsxImport) {
 *   // Renderizar botão de importação
 * }
 * ```
 */

// Client Configuration
export { JUCAO_CONFIG, type JucaoConfig } from './config/client';

// Features
export * from './features/import-xlsx';
