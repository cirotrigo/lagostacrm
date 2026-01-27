/**
 * Constantes para importação de XLSX - JucãoCRM
 *
 * Mapeamento de colunas baseado no formato do arquivo XLSX exportado
 * pelo sistema antigo (Jucao).
 */

/**
 * Header que indica se a linha já foi processada
 */
export const PROCESSADO_HEADER = 'Processado';

/**
 * Headers esperados no formato original do XLSX (Jucao)
 * Ordem: Código, Descrição, Estoque, Grupo, Venda
 */
export const EXPECTED_HEADERS = [
  'Código',
  'Descrição',
  'Estoque',
  'Grupo',
  'Venda',
] as const;

/**
 * Índices posicionais das colunas no XLSX original
 * Usado quando os headers não são encontrados (fallback por posição)
 *
 * Posições: [0]=Código, [3]=Descrição, [6]=Estoque, [9]=Grupo, [13]=Venda
 */
export const POSITIONAL_COLUMN_INDEXES = [0, 3, 6, 9, 13] as const;

/**
 * Mapeamento de colunas do XLSX para campos do produto LagostaCRM
 * Suporta múltiplas variações de nome para cada campo
 */
export const COLUMN_MAPPING = {
  /** Campo SKU - código do produto */
  sku: ['codigo', 'código', 'code', 'sku', 'ref', 'referencia', 'referência'],
  /** Campo name - nome/descrição do produto */
  name: ['descricao', 'descrição', 'nome', 'name', 'produto', 'product'],
  /** Campo price - preço de venda */
  price: ['venda', 'preco', 'preço', 'price', 'valor', 'preco unitario', 'preço unitário'],
  /** Campo description - observações adicionais */
  description: ['obs', 'observacao', 'observação', 'notes', 'notas', 'descricao detalhada'],
} as const;

/**
 * Índice de cada campo nos EXPECTED_HEADERS
 */
export const HEADER_INDEX = {
  sku: 0,      // Código
  name: 1,     // Descrição
  stock: 2,    // Estoque (não usado no LagostaCRM)
  group: 3,    // Grupo (não usado no LagostaCRM)
  price: 4,    // Venda
} as const;

/**
 * Campos obrigatórios para importação
 */
export const REQUIRED_FIELDS = ['name'] as const;

/**
 * Campos opcionais
 */
export const OPTIONAL_FIELDS = ['sku', 'price', 'description'] as const;

/**
 * Tipo para os campos de produto
 */
export type ProductField = keyof typeof COLUMN_MAPPING;

/**
 * Tipo para os headers esperados
 */
export type ExpectedHeader = (typeof EXPECTED_HEADERS)[number];
