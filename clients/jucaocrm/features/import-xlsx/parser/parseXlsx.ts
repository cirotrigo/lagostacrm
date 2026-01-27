/**
 * XLSX Parser
 *
 * Parser para extrair dados de produtos de arquivos XLSX.
 *
 * TODO: Implementar após extrair código do repositório origem
 * - Analisar estrutura do XLSX esperado
 * - Mapear colunas para campos do Product
 * - Implementar validação de dados
 */

import type { ParseXlsxOptions, ParseXlsxResult, XlsxProductRow, XlsxParseError } from '../types';

/**
 * Colunas padrão esperadas no XLSX
 * TODO: Ajustar após análise do formato do repositório origem
 */
export const DEFAULT_COLUMNS = {
  name: ['nome', 'name', 'produto', 'product', 'descrição do produto'],
  price: ['preço', 'price', 'valor', 'value', 'preço unitário'],
  sku: ['sku', 'código', 'code', 'ref', 'referência'],
  description: ['descrição', 'description', 'desc', 'obs', 'observação'],
} as const;

/**
 * Opções padrão do parser
 */
const DEFAULT_OPTIONS: Required<ParseXlsxOptions> = {
  startRow: 1,
  columnMapping: {},
  validate: true,
  skipEmptyRows: true,
};

/**
 * Parseia um arquivo XLSX e extrai dados de produtos
 *
 * @param file - Arquivo XLSX a ser parseado
 * @param options - Opções de parsing
 * @returns Resultado do parsing com dados e erros
 *
 * @example
 * ```typescript
 * const result = await parseXlsx(file);
 * if (result.success) {
 *   console.log(`${result.validRows} produtos válidos`);
 * }
 * ```
 */
export async function parseXlsx(
  file: File,
  options: ParseXlsxOptions = {}
): Promise<ParseXlsxResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors: XlsxParseError[] = [];
  const data: XlsxProductRow[] = [];

  // TODO: Implementar parsing real com biblioteca XLSX
  // Placeholder para estrutura básica

  try {
    // Verificar tipo de arquivo
    if (!isValidXlsxFile(file)) {
      return {
        success: false,
        data: [],
        errors: [{ row: 0, message: 'Arquivo inválido. Esperado .xlsx ou .xls' }],
        totalRows: 0,
        validRows: 0,
      };
    }

    // TODO: Usar biblioteca xlsx para ler o arquivo
    // const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    // const sheet = workbook.Sheets[workbook.SheetNames[0]];
    // const rows = XLSX.utils.sheet_to_json(sheet);

    // Placeholder - será implementado após extrair código do repositório
    console.warn('[parseXlsx] Parser não implementado. Aguardando código do repositório origem.');

    return {
      success: data.length > 0,
      data,
      errors,
      totalRows: data.length + errors.length,
      validRows: data.length,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      errors: [{ row: 0, message: error instanceof Error ? error.message : 'Erro desconhecido' }],
      totalRows: 0,
      validRows: 0,
    };
  }
}

/**
 * Verifica se o arquivo é um XLSX válido
 */
export function isValidXlsxFile(file: File): boolean {
  const validTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
  ];

  const validExtensions = ['.xlsx', '.xls'];
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

  return validTypes.includes(file.type) || validExtensions.includes(extension);
}

/**
 * Detecta automaticamente o mapeamento de colunas baseado no cabeçalho
 *
 * @param headers - Array com nomes das colunas do XLSX
 * @returns Mapeamento de índice da coluna para campo do Product
 */
export function detectColumnMapping(headers: string[]): Record<number, keyof XlsxProductRow> {
  const mapping: Record<number, keyof XlsxProductRow> = {};

  headers.forEach((header, index) => {
    const normalized = header.toLowerCase().trim();

    for (const [field, aliases] of Object.entries(DEFAULT_COLUMNS)) {
      if (aliases.some((alias) => normalized.includes(alias))) {
        mapping[index] = field as keyof XlsxProductRow;
        break;
      }
    }
  });

  return mapping;
}

/**
 * Valida uma linha de dados do XLSX
 *
 * @param row - Dados da linha
 * @param rowIndex - Índice da linha (para mensagens de erro)
 * @returns Array de erros encontrados (vazio se válido)
 */
export function validateRow(row: Partial<XlsxProductRow>, rowIndex: number): XlsxParseError[] {
  const errors: XlsxParseError[] = [];

  // Nome é obrigatório
  if (!row.name || typeof row.name !== 'string' || row.name.trim().length < 2) {
    errors.push({
      row: rowIndex,
      column: 'name',
      message: 'Nome é obrigatório e deve ter pelo menos 2 caracteres',
      value: row.name,
    });
  }

  // Preço deve ser um número válido
  if (row.price !== undefined) {
    const price = typeof row.price === 'string' ? parseFloat(row.price.replace(',', '.')) : row.price;
    if (!Number.isFinite(price) || price < 0) {
      errors.push({
        row: rowIndex,
        column: 'price',
        message: 'Preço deve ser um número válido maior ou igual a zero',
        value: row.price,
      });
    }
  }

  return errors;
}
