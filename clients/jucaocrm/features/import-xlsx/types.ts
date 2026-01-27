/**
 * Types for XLSX Import Feature
 *
 * Tipos utilizados na funcionalidade de importação de produtos via XLSX.
 * Este arquivo será expandido após extrair o código do repositório de origem.
 */

import type { Product } from '@/types';

/**
 * Estrutura esperada de uma linha do XLSX
 * TODO: Mapear campos reais após análise do repositório origem
 */
export interface XlsxProductRow {
  name: string;
  price: number;
  sku?: string;
  description?: string;
  // Campos adicionais serão mapeados após análise do XLSX origem
  [key: string]: unknown;
}

/**
 * Resultado do parsing do arquivo XLSX
 */
export interface ParseXlsxResult {
  success: boolean;
  data: XlsxProductRow[];
  errors: XlsxParseError[];
  totalRows: number;
  validRows: number;
}

/**
 * Erro encontrado durante o parsing
 */
export interface XlsxParseError {
  row: number;
  column?: string;
  message: string;
  value?: unknown;
}

/**
 * Opções para o parser XLSX
 */
export interface ParseXlsxOptions {
  /**
   * Linha onde começam os dados (0-indexed)
   * @default 1 (pula cabeçalho)
   */
  startRow?: number;

  /**
   * Mapeamento de colunas do XLSX para campos do Product
   */
  columnMapping?: Record<string, keyof XlsxProductRow>;

  /**
   * Validar dados durante parsing
   * @default true
   */
  validate?: boolean;

  /**
   * Ignorar linhas vazias
   * @default true
   */
  skipEmptyRows?: boolean;
}

/**
 * Resultado da importação de produtos
 */
export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: ImportError[];
  products: Product[];
}

/**
 * Erro durante importação de um produto
 */
export interface ImportError {
  row: number;
  product?: Partial<XlsxProductRow>;
  message: string;
}

/**
 * Estado do componente de importação
 */
export interface ImportState {
  step: 'idle' | 'selecting' | 'parsing' | 'preview' | 'importing' | 'done' | 'error';
  file: File | null;
  parseResult: ParseXlsxResult | null;
  importResult: ImportResult | null;
  error: string | null;
}

/**
 * Callbacks para o componente de importação
 */
export interface ImportCallbacks {
  onStart?: () => void;
  onProgress?: (current: number, total: number) => void;
  onComplete?: (result: ImportResult) => void;
  onError?: (error: Error) => void;
}
