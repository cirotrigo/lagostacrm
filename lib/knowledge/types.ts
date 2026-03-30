/**
 * Knowledge base types and constants
 * Simplified schema using the existing `documents` table with pgvector
 */

export const KNOWLEDGE_CATEGORIES = [
  'ESTABELECIMENTO_INFO',
  'HORARIOS',
  'CARDAPIO',
  'POLITICAS',
  'CAMPANHAS',
  'FAQ',
  'DIFERENCIAIS',
  'TOM_DE_VOZ',
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  ESTABELECIMENTO_INFO: 'Informações do Estabelecimento',
  HORARIOS: 'Horários',
  CARDAPIO: 'Cardápio',
  POLITICAS: 'Políticas',
  CAMPANHAS: 'Campanhas',
  FAQ: 'Perguntas Frequentes',
  DIFERENCIAIS: 'Diferenciais',
  TOM_DE_VOZ: 'Tom de Voz',
};

export type EntryStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';

/**
 * A document row from the `documents` table.
 * metadata JSONB stores: title, category, tags, status, organization_id
 */
export interface KnowledgeDocument {
  id: string;
  content: string;
  metadata: {
    title: string;
    category: KnowledgeCategory;
    tags?: string[];
    status: EntryStatus;
    organization_id: string;
  };
  embedding: number[] | null;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeListParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: KnowledgeCategory;
  status?: EntryStatus;
}

export interface KnowledgeListResponse {
  entries: KnowledgeDocument[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface CreateKnowledgeInput {
  title: string;
  content: string;
  category: KnowledgeCategory;
  tags?: string[];
  status?: EntryStatus;
}

export interface UpdateKnowledgeInput {
  title?: string;
  content?: string;
  category?: KnowledgeCategory;
  tags?: string[];
  status?: EntryStatus;
}

export interface UploadKnowledgeFileInput {
  title: string;
  filename: string;
  fileContent: string;
  category: KnowledgeCategory;
  tags?: string[];
  status?: EntryStatus;
}
