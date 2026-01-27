/**
 * Types for XLSX Import Feature - JucãoCRM
 *
 * Tipos utilizados na funcionalidade de importação de produtos via XLSX.
 */

/**
 * Status possíveis de um job de importação
 */
export type ImportJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

/**
 * Job de importação - rastreia o progresso de uma importação
 */
export interface ImportJob {
  id: string;
  organizationId: string;
  userId?: string;
  status: ImportJobStatus;
  fileName: string;
  fileUrl?: string;
  totalRows: number;
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  errorCount: number;
  lastError?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

/**
 * Linha na tabela de staging - dados parseados aguardando processamento
 */
export interface ImportStagingRow {
  id: string;
  jobId: string;
  rowIndex: number;
  sku?: string;
  name: string;
  price: number;
  description?: string;
  processed: boolean;
  error?: string;
  createdAt: Date;
}

/**
 * Estrutura de uma linha do XLSX parseada
 */
export interface XlsxProductRow {
  name: string;
  price: number;
  sku?: string;
  description?: string;
}

/**
 * Input para criar um novo job de importação
 */
export interface CreateImportJobInput {
  organizationId: string;
  userId?: string;
  fileName: string;
  fileUrl?: string;
  totalRows: number;
}

/**
 * Progresso de um job de importação
 */
export interface ImportProgress {
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  errorCount: number;
  lastError?: string;
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
  startRow?: number;
  columnMapping?: Record<string, keyof XlsxProductRow>;
  validate?: boolean;
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
  jobId?: string;
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
  job?: ImportJob | null;
}

/**
 * Callbacks para o componente de importação
 */
export interface ImportCallbacks {
  onStart?: () => void;
  onProgress?: (progress: ImportProgress) => void;
  onComplete?: (result: ImportResult) => void;
  onError?: (error: Error) => void;
}

/**
 * Dados do banco para import_jobs (snake_case)
 */
export interface ImportJobRow {
  id: string;
  organization_id: string;
  user_id?: string;
  status: ImportJobStatus;
  file_name: string;
  file_url?: string;
  total_rows: number;
  processed_rows: number;
  created_count: number;
  updated_count: number;
  error_count: number;
  last_error?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

/**
 * Dados do banco para import_staging (snake_case)
 */
export interface ImportStagingDbRow {
  id: string;
  job_id: string;
  row_index: number;
  sku?: string;
  name: string;
  price: number;
  description?: string;
  processed: boolean;
  error?: string;
  created_at: string;
}

/**
 * Converte uma row do banco para o tipo ImportJob
 */
export function toImportJob(row: ImportJobRow): ImportJob {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    status: row.status,
    fileName: row.file_name,
    fileUrl: row.file_url,
    totalRows: row.total_rows,
    processedRows: row.processed_rows,
    createdCount: row.created_count,
    updatedCount: row.updated_count,
    errorCount: row.error_count,
    lastError: row.last_error,
    startedAt: row.started_at ? new Date(row.started_at) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    createdAt: new Date(row.created_at),
  };
}

/**
 * Converte uma row do banco para o tipo ImportStagingRow
 */
export function toImportStagingRow(row: ImportStagingDbRow): ImportStagingRow {
  return {
    id: row.id,
    jobId: row.job_id,
    rowIndex: row.row_index,
    sku: row.sku,
    name: row.name,
    price: row.price,
    description: row.description,
    processed: row.processed,
    error: row.error,
    createdAt: new Date(row.created_at),
  };
}
