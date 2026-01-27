/**
 * Import Products from XLSX Service - JucãoCRM
 *
 * Serviço para importar produtos parseados do XLSX para o banco de dados.
 * Este é um serviço placeholder que será expandido na Phase 3.
 *
 * Na versão final, usará:
 * - importJobService para criar/atualizar jobs
 * - stagingService para inserir dados no staging
 * - webhookService para disparar processamento no N8N
 */

import { productsService } from '@/lib/supabase';
import type { Product } from '@/types';
import type { ImportCallbacks, ImportResult, ImportProgress, XlsxProductRow } from '../types';
import { normalizePrice as normalizeParserPrice } from '../parser/normalizers';

/**
 * Importa produtos do XLSX para o banco de dados
 *
 * @param rows - Linhas parseadas do XLSX
 * @param callbacks - Callbacks para progresso e eventos
 * @returns Resultado da importação
 *
 * @example
 * ```typescript
 * const result = await importProductsFromXlsx(parsedRows, {
 *   onProgress: (progress) => console.log(`${progress.processedRows} processados`),
 *   onComplete: (result) => console.log(`Importados: ${result.imported}`),
 * });
 * ```
 */
export async function importProductsFromXlsx(
  rows: XlsxProductRow[],
  callbacks?: ImportCallbacks
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    imported: 0,
    skipped: 0,
    errors: [],
  };

  if (!rows.length) {
    result.errors.push({ row: 0, message: 'Nenhum produto para importar' });
    return result;
  }

  callbacks?.onStart?.();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIndex = i + 1;

    try {
      const product = await createProductFromRow(row);

      if (product) {
        result.imported++;
      } else {
        result.skipped++;
      }
    } catch (error) {
      result.errors.push({
        row: rowIndex,
        product: row,
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }

    const progress: ImportProgress = {
      processedRows: i + 1,
      createdCount: result.imported,
      updatedCount: 0,
      errorCount: result.errors.length,
    };
    callbacks?.onProgress?.(progress);
  }

  result.success = result.imported > 0;

  if (result.success && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('crm:products-updated'));
  }

  callbacks?.onComplete?.(result);

  return result;
}

/**
 * Cria um produto no banco a partir de uma linha do XLSX
 */
async function createProductFromRow(row: XlsxProductRow): Promise<Product | null> {
  const price = normalizeParserPrice(row.price);

  if (!row.name || row.name.trim().length < 2) {
    throw new Error('Nome inválido');
  }

  if (!Number.isFinite(price) || price < 0) {
    throw new Error('Preço inválido');
  }

  const res = await productsService.create({
    name: row.name.trim(),
    price,
    sku: row.sku?.toString().trim() || undefined,
    description: row.description?.toString().trim() || undefined,
  });

  if (res.error) {
    throw new Error(res.error.message);
  }

  return res.data;
}

/**
 * Verifica se um produto com mesmo SKU já existe
 */
export async function checkSkuExists(sku: string): Promise<boolean> {
  if (!sku) return false;

  const res = await productsService.getAll();
  if (res.error || !res.data) return false;

  return res.data.some((p) => p.sku?.toLowerCase() === sku.toLowerCase());
}

/**
 * Importa produtos com verificação de duplicatas por SKU
 */
export async function importProductsWithDedup(
  rows: XlsxProductRow[],
  skipDuplicates = true,
  callbacks?: ImportCallbacks
): Promise<ImportResult> {
  if (!skipDuplicates) {
    return importProductsFromXlsx(rows, callbacks);
  }

  const existingRes = await productsService.getAll();
  const existingSkus = new Set(
    (existingRes.data || [])
      .map((p) => p.sku?.toLowerCase())
      .filter(Boolean)
  );

  const uniqueRows = rows.filter((row) => {
    if (!row.sku) return true;
    return !existingSkus.has(row.sku.toString().toLowerCase());
  });

  const skipped = rows.length - uniqueRows.length;

  const result = await importProductsFromXlsx(uniqueRows, callbacks);
  result.skipped += skipped;

  return result;
}
