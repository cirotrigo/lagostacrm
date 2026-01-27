/**
 * Import Products from XLSX Service
 *
 * Serviço para importar produtos parseados do XLSX para o banco de dados.
 *
 * TODO: Implementar após extrair código do repositório origem
 */

import { productsService } from '@/lib/supabase';
import type { Product } from '@/types';
import type { ImportCallbacks, ImportResult, XlsxProductRow } from '../types';

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
 *   onProgress: (current, total) => console.log(`${current}/${total}`),
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
    products: [],
  };

  if (!rows.length) {
    result.errors.push({ row: 0, message: 'Nenhum produto para importar' });
    return result;
  }

  callbacks?.onStart?.();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIndex = i + 1; // 1-based para mensagens de erro

    try {
      const product = await createProductFromRow(row);

      if (product) {
        result.products.push(product);
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

    callbacks?.onProgress?.(i + 1, rows.length);
  }

  result.success = result.imported > 0;

  // Notificar app para atualizar listas de produtos
  if (result.success && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('crm:products-updated'));
  }

  callbacks?.onComplete?.(result);

  return result;
}

/**
 * Cria um produto no banco a partir de uma linha do XLSX
 *
 * @param row - Dados da linha
 * @returns Produto criado ou null se falhou
 */
async function createProductFromRow(row: XlsxProductRow): Promise<Product | null> {
  // Normalizar preço (pode vir como string com vírgula)
  const price = normalizePrice(row.price);

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
 * Normaliza o valor do preço para número
 */
function normalizePrice(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Remove R$, pontos de milhar e converte vírgula para ponto
    const cleaned = value
      .replace(/R\$\s*/gi, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim();
    return parseFloat(cleaned) || 0;
  }
  return 0;
}

/**
 * Verifica se um produto com mesmo SKU já existe
 * Útil para evitar duplicatas
 *
 * @param sku - SKU a verificar
 * @returns true se já existe
 */
export async function checkSkuExists(sku: string): Promise<boolean> {
  if (!sku) return false;

  const res = await productsService.getAll();
  if (res.error || !res.data) return false;

  return res.data.some((p) => p.sku?.toLowerCase() === sku.toLowerCase());
}

/**
 * Importa produtos com verificação de duplicatas por SKU
 *
 * @param rows - Linhas parseadas do XLSX
 * @param skipDuplicates - Pular produtos com SKU existente
 * @param callbacks - Callbacks para progresso
 * @returns Resultado da importação
 */
export async function importProductsWithDedup(
  rows: XlsxProductRow[],
  skipDuplicates = true,
  callbacks?: ImportCallbacks
): Promise<ImportResult> {
  if (!skipDuplicates) {
    return importProductsFromXlsx(rows, callbacks);
  }

  // Buscar SKUs existentes
  const existingRes = await productsService.getAll();
  const existingSkus = new Set(
    (existingRes.data || [])
      .map((p) => p.sku?.toLowerCase())
      .filter(Boolean)
  );

  // Filtrar linhas com SKU duplicado
  const uniqueRows = rows.filter((row) => {
    if (!row.sku) return true; // Sem SKU = sempre importa
    return !existingSkus.has(row.sku.toString().toLowerCase());
  });

  const skipped = rows.length - uniqueRows.length;

  const result = await importProductsFromXlsx(uniqueRows, callbacks);
  result.skipped += skipped;

  return result;
}
