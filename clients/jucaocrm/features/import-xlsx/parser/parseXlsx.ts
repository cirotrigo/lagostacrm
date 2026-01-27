/**
 * XLSX Parser - JucãoCRM
 *
 * Parser para extrair dados de produtos de arquivos XLSX.
 * Extraído e adaptado do repositório Jucao para o LagostaCRM.
 *
 * Features:
 * - Detecção inteligente de sheet com dados
 * - Fuzzy matching de headers
 * - Fallback para índices posicionais
 * - Normalização de dados
 */

import * as XLSX from 'xlsx';
import {
  EXPECTED_HEADERS,
  POSITIONAL_COLUMN_INDEXES,
  PROCESSADO_HEADER,
  HEADER_INDEX,
} from '../constants';
import {
  normalizeCell,
  normalizeRowCell,
  normalizeHeaderLabel,
  hasValue,
  normalizePrice,
  normalizeSku,
  findBestHeaderMatch,
  buildExpectedHeaderMap,
} from './normalizers';
import type { XlsxProductRow } from '../types';

/**
 * Resultado do parsing de uma planilha
 */
export interface ParsedSheet {
  /** Valores brutos parseados (inclui header na primeira linha) */
  values: (string | number)[][];
  /** Total de linhas de dados (exclui header) */
  totalRows: number;
  /** Headers normalizados */
  header: string[];
}

/**
 * Resultado do parsing adaptado para produtos do LagostaCRM
 */
export interface ParsedProducts {
  /** Produtos parseados e prontos para importação */
  products: XlsxProductRow[];
  /** Total de linhas no arquivo */
  totalRows: number;
  /** Linhas com erro (índice da linha e mensagem) */
  errors: Array<{ row: number; message: string }>;
  /** Header original detectado */
  header: string[];
}

/**
 * Calcula o range real de uma sheet (ignora metadados)
 */
function getSheetRange(sheet: XLSX.WorkSheet): string | undefined {
  let minRow = Number.POSITIVE_INFINITY;
  let minCol = Number.POSITIVE_INFINITY;
  let maxRow = -1;
  let maxCol = -1;

  Object.keys(sheet).forEach((key) => {
    if (key.startsWith('!')) return;
    const { r, c } = XLSX.utils.decode_cell(key);
    if (r < minRow) minRow = r;
    if (c < minCol) minCol = c;
    if (r > maxRow) maxRow = r;
    if (c > maxCol) maxCol = c;
  });

  if (maxRow < 0 || maxCol < 0) {
    return undefined;
  }

  return XLSX.utils.encode_range({
    s: { r: Math.max(0, minRow), c: Math.max(0, minCol) },
    e: { r: maxRow, c: maxCol },
  });
}

/**
 * Parseia um buffer de arquivo XLSX e retorna dados brutos
 *
 * Algoritmo:
 * 1. Detecta a melhor sheet (com mais colunas e headers conhecidos)
 * 2. Tenta matching de headers por nome (fuzzy)
 * 3. Fallback para índices posicionais se necessário
 */
export function parseImportXlsxBuffer(buffer: ArrayBuffer): ParsedSheet {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetNames = workbook.SheetNames;

  if (!sheetNames.length) {
    throw new Error('Arquivo sem planilhas válidas.');
  }

  const expectedMap = buildExpectedHeaderMap(EXPECTED_HEADERS);
  const expectedNormalized = Object.keys(expectedMap);
  const expectedSet = new Set(expectedNormalized);

  let best: {
    sheetName: string;
    headerIndex: number;
    mappedHeaders: string[];
    normalizedHeader: string[];
    present: Set<string>;
    rows: unknown[][];
    columnIndexByExpected: Map<string, number>;
  } | null = null;
  let bestMatchCount = -1;
  let bestByColumns: {
    sheetName: string;
    headerIndex: number;
    rows: unknown[][];
    maxColumns: number;
  } | null = null;
  let bestColumnCount = -1;

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const range = getSheetRange(sheet);

    const rawRows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      ...(range ? { range } : {}),
    }) as unknown[][];

    const rows = rawRows.filter(
      (row): row is unknown[] => Array.isArray(row) && row.some(hasValue)
    );

    if (rows.length === 0) {
      continue;
    }

    let maxColumns = -1;
    let widestIndex = 0;
    rows.forEach((row, index) => {
      if (row.length > maxColumns) {
        maxColumns = row.length;
        widestIndex = index;
      }
    });

    if (maxColumns > bestColumnCount) {
      bestColumnCount = maxColumns;
      bestByColumns = {
        sheetName,
        headerIndex: widestIndex,
        rows,
        maxColumns,
      };
    }

    const rowMatches = rows.map((row) => {
      const normalizedRow = row.map(normalizeHeaderLabel);
      const matches = new Set<string>();
      let score = 0;

      normalizedRow.forEach((cell) => {
        if (!cell) return;
        if (expectedSet.has(cell)) {
          matches.add(cell);
          score += 2;
          return;
        }
        const bestMatch = findBestHeaderMatch(cell, expectedNormalized);
        if (bestMatch) {
          matches.add(bestMatch);
          score += 1;
        }
      });

      return { normalizedRow, matches, score };
    });

    let headerIndex = 0;
    let matchScore = -1;
    rowMatches.forEach((row, index) => {
      if (row.score > matchScore) {
        matchScore = row.score;
        headerIndex = index;
      }
    });

    const headerRow = rows[headerIndex].map(normalizeCell);
    const normalizedHeaderRow = rowMatches[headerIndex]?.normalizedRow || [];
    const candidates: Array<{
      expected: string;
      index: number;
      normalizedCell: string;
      exact: boolean;
    }> = [];

    headerRow.forEach((cell, index) => {
      const normalizedCell = normalizedHeaderRow[index] || normalizeHeaderLabel(cell);
      const bestMatch = findBestHeaderMatch(normalizedCell, expectedNormalized);
      if (!bestMatch) return;
      candidates.push({
        expected: bestMatch,
        index,
        normalizedCell,
        exact: expectedSet.has(normalizedCell),
      });
    });

    const columnIndexByExpected = new Map<string, number>();
    expectedNormalized.forEach((expected) => {
      const options = candidates.filter((candidate) => candidate.expected === expected);
      if (options.length === 0) return;
      const exactOptions = options.filter((option) => option.exact);
      const pickFrom = exactOptions.length ? exactOptions : options;
      pickFrom.sort((a, b) => {
        if (a.normalizedCell.length !== b.normalizedCell.length) {
          return a.normalizedCell.length - b.normalizedCell.length;
        }
        return a.index - b.index;
      });
      columnIndexByExpected.set(expected, pickFrom[0].index);
    });

    const present = new Set(columnIndexByExpected.keys());

    if (present.size > bestMatchCount) {
      bestMatchCount = present.size;
      best = {
        sheetName,
        headerIndex,
        mappedHeaders: headerRow,
        normalizedHeader: [...EXPECTED_HEADERS],
        present,
        rows,
        columnIndexByExpected,
      };
    }
  }

  if (!best) {
    throw new Error('Planilha vazia.');
  }

  const positionalIndexes = POSITIONAL_COLUMN_INDEXES.slice(0, EXPECTED_HEADERS.length);
  const hasPositionalIndexes =
    positionalIndexes.length === EXPECTED_HEADERS.length && positionalIndexes.length > 0;
  const maxIndex = Math.max(...positionalIndexes);
  const positionalSource = bestByColumns ?? {
    sheetName: best.sheetName,
    headerIndex: best.headerIndex,
    rows: best.rows,
    maxColumns: best.rows.reduce((currentMax, row) => Math.max(currentMax, row.length), 0),
  };
  const hasColumns = hasPositionalIndexes && positionalSource.maxColumns > maxIndex;

  if (hasColumns) {
    const normalizedHeader = [...EXPECTED_HEADERS, PROCESSADO_HEADER];
    const normalizedRows: (string | number)[][] = [normalizedHeader];
    const startIndex = Math.min(positionalSource.headerIndex + 1, positionalSource.rows.length);

    positionalSource.rows.slice(startIndex).forEach((row) => {
      const normalizedRow = positionalIndexes.map((index) => normalizeRowCell(row[index]));
      normalizedRow.push('');
      normalizedRows.push(normalizedRow);
    });

    return {
      values: normalizedRows,
      totalRows: Math.max(0, normalizedRows.length - 1),
      header: normalizedHeader,
    };
  }

  const missing = EXPECTED_HEADERS.filter((header) => {
    const normalized = normalizeHeaderLabel(header);
    return !best.columnIndexByExpected.has(normalized);
  });

  if (missing.length > 0) {
    throw new Error(
      `Colunas obrigatórias ausentes: ${missing.join(', ')}. ` +
        `Aba: ${best.sheetName}. Headers encontrados: ${best.mappedHeaders.join(', ')}.`
    );
  }

  const normalizedHeader = [...EXPECTED_HEADERS, PROCESSADO_HEADER];
  const normalizedRows: (string | number)[][] = [normalizedHeader];
  const expectedIndexes = EXPECTED_HEADERS.map((header) => {
    const normalized = normalizeHeaderLabel(header);
    return best.columnIndexByExpected.get(normalized) ?? -1;
  });

  best.rows.slice(best.headerIndex + 1).forEach((row) => {
    const normalizedRow: (string | number)[] = expectedIndexes.map((index) => {
      const cell = index >= 0 ? row[index] : '';
      return normalizeRowCell(cell);
    });
    normalizedRow.push('');
    normalizedRows.push(normalizedRow);
  });

  return {
    values: normalizedRows,
    totalRows: Math.max(0, normalizedRows.length - 1),
    header: normalizedHeader,
  };
}

/**
 * Parseia um arquivo XLSX e retorna dados brutos
 */
export async function parseImportXlsx(file: File): Promise<ParsedSheet> {
  const buffer = await file.arrayBuffer();
  return parseImportXlsxBuffer(buffer);
}

/**
 * Converte os dados brutos do XLSX para produtos do LagostaCRM
 *
 * Mapeia:
 * - Código → sku
 * - Descrição → name
 * - Venda → price
 */
export function convertToProducts(parsed: ParsedSheet): ParsedProducts {
  const products: XlsxProductRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  // Pula a primeira linha (header)
  for (let i = 1; i < parsed.values.length; i++) {
    const row = parsed.values[i];
    const rowIndex = i + 1; // Índice 1-based para mensagens de erro

    try {
      const sku = normalizeSku(row[HEADER_INDEX.sku]);
      const name = normalizeCell(row[HEADER_INDEX.name]);
      const price = normalizePrice(row[HEADER_INDEX.price]);

      // Nome é obrigatório
      if (!name || name.length < 2) {
        errors.push({ row: rowIndex, message: 'Nome é obrigatório' });
        continue;
      }

      products.push({
        name,
        price,
        sku,
        description: undefined,
      });
    } catch (error) {
      errors.push({
        row: rowIndex,
        message: error instanceof Error ? error.message : 'Erro ao processar linha',
      });
    }
  }

  return {
    products,
    totalRows: parsed.totalRows,
    errors,
    header: parsed.header,
  };
}

/**
 * Parseia um arquivo XLSX e retorna produtos prontos para importação
 *
 * Esta é a função principal a ser usada pela UI.
 *
 * @example
 * ```typescript
 * const result = await parseXlsxToProducts(file);
 * if (result.errors.length === 0) {
 *   await importProducts(result.products);
 * }
 * ```
 */
export async function parseXlsxToProducts(file: File): Promise<ParsedProducts> {
  const parsed = await parseImportXlsx(file);
  return convertToProducts(parsed);
}

/**
 * Verifica se o arquivo é um XLSX válido
 */
export function isValidXlsxFile(file: File): boolean {
  const validTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];
  const validExtensions = ['.xlsx', '.xls'];
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

  return validTypes.includes(file.type) || validExtensions.includes(extension);
}
