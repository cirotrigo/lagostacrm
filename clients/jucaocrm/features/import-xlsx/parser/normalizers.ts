/**
 * Normalizers para parsing de XLSX - JucãoCRM
 *
 * Funções para normalização de células e headers do arquivo XLSX.
 * Extraído e adaptado do repositório Jucao.
 */

import { COLUMN_MAPPING, type ProductField } from '../constants';

/**
 * Normaliza o valor de uma célula para string trimada
 */
export function normalizeCell(value: unknown): string {
  return String(value ?? '').trim();
}

/**
 * Normaliza o valor de uma célula mantendo números como números
 * Usado para preservar valores numéricos durante o parsing
 */
export function normalizeRowCell(cell: unknown): string | number {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'number') return cell;
  return String(cell);
}

/**
 * Normaliza um label de header para comparação
 *
 * Remove:
 * - BOM (Byte Order Mark)
 * - Acentos
 * - Caracteres especiais
 * - Espaços extras
 *
 * @example
 * normalizeHeaderLabel('Código') // 'codigo'
 * normalizeHeaderLabel('Preço Unitário') // 'preco unitario'
 */
export function normalizeHeaderLabel(value: unknown): string {
  const text = normalizeCell(value).replace(/^\uFEFF/, '');
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Verifica se uma célula tem valor
 */
export function hasValue(value: unknown): boolean {
  return normalizeCell(value) !== '';
}

/**
 * Normaliza um preço para número
 *
 * @example
 * normalizePrice('1.234,56') // 1234.56
 * normalizePrice('R$ 99,90') // 99.9
 * normalizePrice(99.9) // 99.9
 */
export function normalizePrice(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const str = normalizeCell(value)
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const num = parseFloat(str);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Normaliza um SKU removendo espaços e caracteres inválidos
 */
export function normalizeSku(value: unknown): string | undefined {
  const str = normalizeCell(value);
  if (!str) return undefined;

  return str
    .toUpperCase()
    .replace(/[^A-Z0-9\-_.]/g, '')
    .trim() || undefined;
}

/**
 * Encontra a melhor correspondência entre um header normalizado
 * e os headers esperados
 */
export function findBestHeaderMatch(
  normalizedCell: string,
  expectedKeys: string[]
): string | null {
  const matches = expectedKeys.filter(
    (expected) =>
      normalizedCell.includes(expected) || expected.includes(normalizedCell)
  );

  if (matches.length === 0) return null;

  return matches.sort((a, b) => b.length - a.length)[0] || null;
}

/**
 * Detecta qual campo do produto um header representa
 */
export function detectFieldFromHeader(header: string): ProductField | null {
  const normalized = normalizeHeaderLabel(header);

  for (const [field, aliases] of Object.entries(COLUMN_MAPPING)) {
    for (const alias of aliases) {
      const normalizedAlias = normalizeHeaderLabel(alias);
      if (normalized === normalizedAlias || normalized.includes(normalizedAlias)) {
        return field as ProductField;
      }
    }
  }

  return null;
}

/**
 * Cria um mapa de headers esperados para seus valores normalizados
 */
export function buildExpectedHeaderMap(headers: readonly string[]): Record<string, string> {
  return headers.reduce<Record<string, string>>((acc, header) => {
    acc[normalizeHeaderLabel(header)] = header;
    return acc;
  }, {});
}
