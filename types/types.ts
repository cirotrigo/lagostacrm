/**
 * @fileoverview Definições de Tipos do CRM
 * 
 * Arquivo central de tipos TypeScript para o sistema NossoCRM.
 * Contém interfaces para todas as entidades do domínio.
 * 
 * @module types
 * 
 * Sistema SINGLE-TENANT (migrado em 2025-12-07)
 * 
 * @example
 * ```tsx
 * import { Deal, DealView, Contact, Board } from '@/types';
 * 
 * const deal: Deal = {
 *   title: 'Meu deal',
 *   value: 1000,
 *   // ...
 * };
 * ```
 */

/**
 * @deprecated Use deal.isWon e deal.isLost para verificar status final.
 * O estágio atual é deal.status (UUID do stage no board).
 * Mantido apenas para compatibilidade de código legado.
 */
export enum DealStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  CLOSED_WON = 'CLOSED_WON',
  CLOSED_LOST = 'CLOSED_LOST',
}

// =============================================================================
// TYPE ALIASES (LEGACY - MANTIDOS PARA COMPATIBILIDADE)
// =============================================================================

/**
 * @deprecated Sistema migrado para single-tenant.
 * Mantido apenas para compatibilidade de código legado.
 * Campos organization_id são opcionais e ignorados.
 */
export type OrganizationId = string;

/**
 * Client Company ID - UUID de empresa CLIENTE cadastrada no CRM
 * 
 * @description
 * Este ID representa uma empresa que é cliente/prospect do usuário do CRM.
 * É um relacionamento comercial, não relacionado a segurança.
 * 
 * @origin Selecionado pelo usuário em dropdowns/formulários
 * @optional Pode ser null (contatos podem não ter empresa)
 * 
 * @example
 * ```ts
 * // ✅ Correto: client_company_id vem de seleção do usuário
 * const deal = { 
 *   organization_id: organizationId,     // Do auth (segurança)
 *   client_company_id: selectedCompany,  // Do form (opcional)
 * };
 * ```
 */
export type ClientCompanyId = string;

// =============================================================================
// Core Types
// =============================================================================

// Estágio do Ciclo de Vida (Dinâmico)
export interface LifecycleStage {
  id: string;
  name: string;
  color: string; // Tailwind class or hex
  order: number;
  isDefault?: boolean; // Cannot be deleted
}

// Estágio do Contato no Funil de Carteira
// @deprecated - Use LifecycleStage IDs (strings)
export enum ContactStage {
  LEAD = 'LEAD', // Suspeito - ainda não qualificado
  MQL = 'MQL', // Marketing Qualified Lead
  PROSPECT = 'PROSPECT', // Em negociação ativa
  CUSTOMER = 'CUSTOMER', // Cliente fechado
}

/**
 * Origem do contato no CRM.
 *
 * Inclui origens comerciais tradicionais e canais de mensageria.
 */
export type ContactSource =
  | 'WEBSITE'
  | 'LINKEDIN'
  | 'REFERRAL'
  | 'MANUAL'
  | 'WHATSAPP'
  | 'INSTAGRAM';

// @deprecated - Use Contact com stage: ContactStage.LEAD
// Mantido apenas para compatibilidade de migração
export interface Lead {
  id: string;
  name: string; // Nome da pessoa
  email: string;
  companyName: string; // Texto solto, ainda não é uma Company
  role?: string;
  source: ContactSource;
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'DISQUALIFIED';
  createdAt: string;
  notes?: string;
}

// =============================================================================
// Organization (Tenant - who pays for SaaS)
// =============================================================================

/**
 * Organization - The SaaS tenant (company paying for the service)
 * Previously named "Company" - renamed to avoid confusion with CRM client companies
 */
export interface Organization {
  id: OrganizationId;
  name: string;
  industry?: string;
  website?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * @deprecated Use Organization instead
 * Kept for backwards compatibility during migration
 */
export type Company = Organization;

// =============================================================================
// CRM Company (Client company in the CRM)
// =============================================================================

/**
 * CRMCompany - A client company record in the CRM
 * This is a company that the user is selling to/managing
 */
export interface CRMCompany {
  id: ClientCompanyId;
  organizationId?: OrganizationId; // Tenant FK (for RLS) - optional during migration
  name: string;
  industry?: string;
  website?: string;
  createdAt: string;
  updatedAt?: string;
}

// =============================================================================
// Contact (Person we talk to)
// =============================================================================

// A Pessoa (Com quem falamos)
export interface Contact {
  id: string;
  organizationId?: OrganizationId; // Tenant FK (for RLS) - optional during migration
  clientCompanyId?: ClientCompanyId; // CRM company this contact belongs to
  name: string;
  role?: string;
  email: string;
  phone: string;
  avatar?: string;
  lastInteraction?: string;
  birthDate?: string; // New field for Agentic AI tasks
  status: 'ACTIVE' | 'INACTIVE' | 'CHURNED';
  stage: string; // ID do LifecycleStage (antes era ContactStage enum)
  source?: ContactSource; // Origem do contato
  notes?: string; // Anotações gerais
  lastPurchaseDate?: string;
  totalValue?: number; // LTV
  createdAt: string;
  updatedAt?: string; // Última modificação do registro

  // @deprecated - Use clientCompanyId instead
  companyId?: string;
}

// ITEM 3: Produtos e Serviços
export interface Product {
  id: string;
  organizationId?: OrganizationId; // Tenant FK (for RLS) - optional during migration
  name: string;
  description?: string;
  price: number;
  sku?: string;
  /** Se está ativo no catálogo (itens inativos não devem aparecer no dropdown do deal). */
  active?: boolean;
}

export interface DealItem {
  id: string;
  organizationId?: OrganizationId; // Tenant FK (for RLS) - optional during migration
  productId: string;
  name: string; // Snapshot of name
  quantity: number;
  price: number; // Snapshot of price
}

// CUSTOM FIELDS DEFINITION
export type CustomFieldType = 'text' | 'number' | 'date' | 'select';

export interface CustomFieldDefinition {
  id: string;
  key: string; // camelCase identifier
  label: string;
  type: CustomFieldType;
  options?: string[]; // For select type
}

// O Dinheiro/Oportunidade (O que vai no Kanban)
export interface Deal {
  id: string;
  organizationId?: OrganizationId; // Tenant FK (for RLS) - optional during migration
  clientCompanyId?: ClientCompanyId; // CRM company FK
  title: string; // Ex: "Licença Anual"
  contactId: string; // Relacionamento
  boardId: string; // Qual board este deal pertence
  value: number;
  items: DealItem[]; // Lista de Produtos
  status: string; // Stage ID dentro do board (UUID)
  isWon: boolean; // Deal foi ganho?
  isLost: boolean; // Deal foi perdido?
  closedAt?: string; // Quando foi fechado
  createdAt: string;
  updatedAt: string;
  probability: number;
  priority: 'low' | 'medium' | 'high';
  owner: {
    name: string;
    avatar: string;
  };
  ownerId?: string; // ID do usuário responsável
  nextActivity?: {
    type: 'CALL' | 'MEETING' | 'EMAIL' | 'TASK';
    date: string;
    isOverdue?: boolean;
  };
  tags: string[];
  aiSummary?: string;
  customFields?: Record<string, any>; // Dynamic fields storage
  lastStageChangeDate?: string; // For stagnation tracking
  lossReason?: string; // For win/loss analysis

  // @deprecated - Use clientCompanyId instead
  companyId?: string;
}

// Helper Type para Visualização (Desnormalizado)
export interface DealView extends Deal {
  clientCompanyName?: string; // Name of the CRM client company
  contactName: string;
  contactEmail: string;
  contactAvatar?: string; // Contact avatar URL from Chatwoot sync
  contactSource?: ContactSource;
  /** Nome/label do estágio atual (resolvido a partir do status UUID) */
  stageLabel: string;

  // @deprecated - Use clientCompanyName instead
  companyName?: string;
}

export interface Activity {
  id: string;
  organizationId?: OrganizationId; // Tenant FK (for RLS) - optional during migration
  dealId: string;
  /** ID do contato associado (opcional). Útil para tarefas sem deal. */
  contactId?: string;
  /** ID da empresa CRM associada (opcional). Derivado do deal ou contato. */
  clientCompanyId?: ClientCompanyId;
  /** IDs dos contatos participantes (opcional). */
  participantContactIds?: string[];
  dealTitle: string;
  type: 'CALL' | 'MEETING' | 'EMAIL' | 'TASK' | 'NOTE' | 'STATUS_CHANGE';
  title: string;
  description?: string;
  date: string;
  user: {
    name: string;
    avatar: string;
  };
  completed: boolean;
}

export interface DashboardStats {
  totalDeals: number;
  pipelineValue: number;
  conversionRate: number;
  winRate: number;
}

// Estágio de um Board (etapa do Kanban)
export interface BoardStage {
  id: string;
  organizationId?: OrganizationId; // Tenant FK (for RLS) - optional for templates
  boardId?: string; // Board FK - optional for templates
  label: string;
  color: string;
  linkedLifecycleStage?: string; // ID do LifecycleStage
}

// Metas do Board (Revenue Ops)
export interface BoardGoal {
  description: string; // "Converter 20% dos leads"
  kpi: string; // "Taxa de Conversão"
  targetValue: string; // "20%"
  currentValue?: string; // "15%" (Progresso atual)
  type?: 'currency' | 'number' | 'percentage'; // Explicit type for calculation
}

// Persona do Agente (Quem opera o board)
export interface AgentPersona {
  name: string; // "Dra. Ana (Virtual)"
  role: string; // "Consultora de Beleza"
  behavior: string; // "Empática, usa emojis..."
}

// Board = Kanban configurável (ex: Pipeline de Vendas, Onboarding, etc)
export interface Board {
  id: string;
  organizationId?: OrganizationId; // Tenant FK (for RLS) - optional for templates
  name: string;
  /**
   * Identificador humano e estável (slug) para integrações.
   * Ex.: "sales", "pos-venda".
   */
  key?: string;
  description?: string;
  linkedStage?: ContactStage; // Quando mover para etapa final, atualiza o stage do contato
  linkedLifecycleStage?: string; // Qual lifecycle stage este board gerencia (ex: 'LEAD', 'MQL', 'CUSTOMER')
  nextBoardId?: string; // Quando mover para etapa final (Ganho), cria um card neste board
  wonStageId?: string; // Estágio de Ganho
  lostStageId?: string; // Estágio de Perda
  wonStayInStage?: boolean; // Se true, "Arquiva" na etapa atual (status Won) em vez de mover
  lostStayInStage?: boolean; // Se true, "Arquiva" na etapa atual (status Lost) em vez de mover
  /** Produto padrão sugerido para deals desse board (opcional). */
  defaultProductId?: string;
  stages: BoardStage[];
  isDefault?: boolean;
  template?: 'PRE_SALES' | 'SALES' | 'ONBOARDING' | 'CS' | 'CUSTOM'; // Template usado para criar este board
  automationSuggestions?: string[]; // Sugestões de automação da IA

  // AI Strategy Fields
  goal?: BoardGoal;
  agentPersona?: AgentPersona;
  entryTrigger?: string; // "Quem deve entrar aqui?"

  createdAt: string;
}

// Estágios padrão do board de vendas
export const DEFAULT_BOARD_STAGES: BoardStage[] = [
  { id: DealStatus.NEW, label: 'Novas Oportunidades', color: 'bg-blue-500' },
  { id: DealStatus.CONTACTED, label: 'Contatado', color: 'bg-yellow-500' },
  {
    id: DealStatus.PROPOSAL,
    label: 'Proposta',
    color: 'bg-purple-500',
    linkedLifecycleStage: ContactStage.PROSPECT,
  },
  {
    id: DealStatus.NEGOTIATION,
    label: 'Negociação',
    color: 'bg-orange-500',
    linkedLifecycleStage: ContactStage.PROSPECT,
  },
  {
    id: DealStatus.CLOSED_WON,
    label: 'Ganho',
    color: 'bg-green-500',
    linkedLifecycleStage: ContactStage.CUSTOMER,
  },
];

// @deprecated - Use DEFAULT_BOARD_STAGES
export const PIPELINE_STAGES = DEFAULT_BOARD_STAGES;

// Registry Types
export interface RegistryTemplate {
  id: string;
  path: string;
  name: string;
  description: string;
  author: string;
  version: string;
  tags: string[];
}

export interface RegistryIndex {
  version: string;
  templates: RegistryTemplate[];
}

export interface JourneyDefinition {
  schemaVersion: string;
  name?: string;
  boards: {
    slug: string;
    name: string;
    columns: {
      name: string;
      color?: string;
      linkedLifecycleStage?: string;
    }[];
    strategy?: {
      agentPersona?: AgentPersona;
      goal?: BoardGoal;
      entryTrigger?: string;
    };
  }[];
}

// =============================================================================
// Pagination Types (Server-Side)
// =============================================================================

/**
 * Estado de paginação para controle de navegação.
 * Compatível com TanStack Table.
 * 
 * @example
 * ```ts
 * const [pagination, setPagination] = useState<PaginationState>({
 *   pageIndex: 0,
 *   pageSize: 50,
 * });
 * ```
 */
export interface PaginationState {
  /** Índice da página atual (0-indexed). */
  pageIndex: number;
  /** Quantidade de itens por página. */
  pageSize: number;
}

/** Opções válidas para tamanho de página. */
export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

/** Tamanho de página padrão. */
export const DEFAULT_PAGE_SIZE = 50;

/**
 * Resposta paginada genérica do servidor.
 * 
 * @template T Tipo dos itens retornados.
 * 
 * @example
 * ```ts
 * const response: PaginatedResponse<Contact> = {
 *   data: [...],
 *   totalCount: 10000,
 *   pageIndex: 0,
 *   pageSize: 50,
 *   hasMore: true,
 * };
 * ```
 */
export interface PaginatedResponse<T> {
  /** Array de itens da página atual. */
  data: T[];
  /** Total de registros no banco (para calcular número de páginas). */
  totalCount: number;
  /** Índice da página retornada (0-indexed). */
  pageIndex: number;
  /** Tamanho da página solicitada. */
  pageSize: number;
  /** Se existem mais páginas após esta. */
  hasMore: boolean;
}

/**
 * Filtros de contatos para busca server-side.
 * Extensão dos filtros existentes com suporte a paginação.
 */
export interface ContactsServerFilters {
  /** Busca por nome ou email (case-insensitive). */
  search?: string;
  /** Filtro por estágio do funil. */
  stage?: string | 'ALL';
  /** Filtro por status. */
  status?: 'ALL' | 'ACTIVE' | 'INACTIVE' | 'CHURNED' | 'RISK';
  /** Data de início (created_at >= dateStart). */
  dateStart?: string;
  /** Data de fim (created_at <= dateEnd). */
  dateEnd?: string;
  /** ID da empresa cliente (opcional). */
  clientCompanyId?: string;
  /** Campo para ordenação. */
  sortBy?: ContactSortableColumn;
  /** Direção da ordenação. */
  sortOrder?: 'asc' | 'desc';
}

/** Colunas ordenáveis na tabela de contatos. */
export type ContactSortableColumn = 'name' | 'created_at' | 'updated_at' | 'stage';

// =============================================================================
// WhatsApp Messaging Types
// =============================================================================

/**
 * Status de conexão da sessão WhatsApp.
 */
export type WhatsAppSessionStatus =
  | 'disconnected'
  | 'connecting'
  | 'qr_pending'
  | 'connected'
  | 'error';

/**
 * Sessão WhatsApp conectada ao WPPConnect.
 */
export interface WhatsAppSession {
  id: string;
  organization_id: string;
  session_name: string;
  phone_number: string | null;
  profile_name: string | null;
  profile_picture_url: string | null;
  status: WhatsAppSessionStatus;
  qr_code: string | null;
  error_message: string | null;
  is_default: boolean;
  webhook_url: string | null;
  auto_reconnect: boolean;
  connected_at: string | null;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Status de uma conversa WhatsApp.
 */
export type WhatsAppConversationStatus = 'open' | 'pending' | 'resolved' | 'archived';

/**
 * Direção da mensagem.
 */
export type MessageDirection = 'inbound' | 'outbound';

/**
 * Conversa WhatsApp com um contato.
 */
export interface WhatsAppConversation {
  id: string;
  organization_id: string;
  session_id: string;
  contact_id: string | null;
  deal_id: string | null;
  remote_jid: string;
  is_group: boolean;
  group_name: string | null;
  status: WhatsAppConversationStatus;
  assigned_to: string | null;
  ai_enabled: boolean;
  unread_count: number;
  total_messages: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_direction: MessageDirection | null;
  created_at: string;
  updated_at: string;
}

/**
 * Conversa com dados do contato (view).
 */
export interface WhatsAppConversationView extends WhatsAppConversation {
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_avatar: string | null;
  deal_title: string | null;
  deal_value: number | null;
  deal_stage: string | null;
  session_name: string;
  session_phone: string | null;
  messaging_source?: MessagingSource | null;
}

/**
 * Tipo de mídia da mensagem.
 */
export type WhatsAppMediaType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contact'
  | 'poll';

/**
 * Status de entrega da mensagem.
 */
export type WhatsAppMessageStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

/**
 * Mensagem WhatsApp.
 */
export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  wpp_message_id: string | null;
  direction: MessageDirection;
  media_type: WhatsAppMediaType;
  content: string | null;
  caption: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  media_filename: string | null;
  media_size_bytes: number | null;
  location_lat: number | null;
  location_lng: number | null;
  location_name: string | null;
  status: WhatsAppMessageStatus;
  status_updated_at: string | null;
  error_message: string | null;
  sender_jid: string | null;
  sender_name: string | null;
  sender_phone: string | null;
  quoted_message_id: string | null;
  is_from_me: boolean;
  is_forwarded: boolean;
  is_broadcast: boolean;
  wpp_timestamp: string | null;
  created_at: string;
}

/**
 * Direção de sincronização de labels.
 */
export type LabelSyncDirection = 'to_crm' | 'to_wpp' | 'both' | 'none';

/**
 * Mapeamento de label WhatsApp para tag CRM.
 */
export interface WhatsAppLabelSync {
  id: string;
  organization_id: string;
  session_id: string;
  wpp_label_id: string;
  wpp_label_name: string;
  wpp_label_color: string | null;
  crm_tag_id: string | null;
  sync_direction: LabelSyncDirection;
  auto_create_tag: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Label aplicada a uma conversa.
 */
export interface WhatsAppConversationLabel {
  id: string;
  conversation_id: string;
  label_sync_id: string;
  applied_at: string;
  applied_by: 'wpp' | 'crm' | 'n8n' | null;
}

/**
 * Evento de webhook recebido.
 */
export interface WhatsAppWebhookEvent {
  id: string;
  organization_id: string | null;
  session_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  status: 'received' | 'processing' | 'processed' | 'failed' | 'ignored';
  error_message: string | null;
  processed_at: string | null;
  received_at: string;
}

/**
 * Categoria de template de mensagem.
 */
export type MessageTemplateCategory = 'general' | 'greeting' | 'follow_up' | 'closing';

/**
 * Template de mensagem reutilizável.
 */
export interface WhatsAppMessageTemplate {
  id: string;
  organization_id: string;
  name: string;
  category: MessageTemplateCategory;
  content: string;
  media_url: string | null;
  media_type: string | null;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

/**
 * Payload para enviar mensagem.
 */
export interface SendMessagePayload {
  conversation_id: string;
  content: string;
  media_url?: string;
  media_type?: WhatsAppMediaType;
  quoted_message_id?: string;
}

/**
 * Filtros para listagem de conversas.
 */
export interface ConversationFilters {
  status?: WhatsAppConversationStatus | 'all';
  assigned_to?: string | 'unassigned' | 'all';
  source?: MessagingSource | 'all';
  search?: string;
  has_unread?: boolean;
}

/**
 * Resposta da API de conversas.
 */
export interface ConversationsResponse {
  data: WhatsAppConversationView[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Resposta da API de mensagens.
 */
export interface MessagesResponse {
  data: WhatsAppMessage[];
  has_more: boolean;
  oldest_id: string | null;
}

// =============================================================================
// Messaging Contact Identities (Multi-Channel)
// =============================================================================

/**
 * Source channel for messaging identity.
 *
 * @description
 * Identifies the messaging platform from which the contact originated.
 * Used for external identity resolution across channels.
 */
export type MessagingSource = 'WHATSAPP' | 'INSTAGRAM';

/**
 * External identity mapping for a contact.
 *
 * @description
 * Links CRM contacts to external channel identifiers.
 * Enables deterministic identity resolution for multi-channel messaging.
 *
 * @example
 * ```ts
 * // WhatsApp identity
 * const whatsappIdentity: MessagingContactIdentity = {
 *   id: 'uuid',
 *   organizationId: 'org-uuid',
 *   contactId: 'contact-uuid',
 *   source: 'WHATSAPP',
 *   externalId: '+5511999990000', // E.164 phone
 *   createdAt: '2026-02-18T00:00:00Z',
 *   updatedAt: '2026-02-18T00:00:00Z',
 * };
 *
 * // Instagram identity
 * const instagramIdentity: MessagingContactIdentity = {
 *   id: 'uuid',
 *   organizationId: 'org-uuid',
 *   contactId: 'contact-uuid',
 *   source: 'INSTAGRAM',
 *   externalId: '17841400000000000', // Instagram IGSID
 *   createdAt: '2026-02-18T00:00:00Z',
 *   updatedAt: '2026-02-18T00:00:00Z',
 * };
 * ```
 */
export interface MessagingContactIdentity {
  /** Unique identifier */
  id: string;
  /** Organization ID for multi-tenant isolation */
  organizationId: string;
  /** CRM contact ID */
  contactId: string;
  /** Channel source (WHATSAPP or INSTAGRAM) */
  source: MessagingSource;
  /** External identifier from the messaging platform */
  externalId: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Result of identity resolution.
 *
 * @description
 * Contains the resolved contact information and metadata about
 * how the resolution was performed.
 */
export interface IdentityResolutionResult {
  /** CRM contact ID */
  contactId: string;
  /** Identity mapping ID (null if resolved via fallback) */
  identityId: string | null;
  /** Channel source */
  source: MessagingSource;
  /** Normalized external identifier */
  externalId: string;
  /** How the identity was resolved */
  resolutionMethod: 'identity' | 'phone' | 'email' | 'created';
}
