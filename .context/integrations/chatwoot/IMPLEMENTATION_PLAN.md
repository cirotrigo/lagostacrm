# Plano de Implementação: Messaging Omnichannel via Chatwoot no LagostaCRM

> **Versão:** 1.2
> **Data:** 2026-02-13
> **Status:** Planejamento (Pronto para Execução)
> **Branch:** `feature/chatwoot-messaging`
> **Revisão:** Correções de triggers, colunas e simplificação de webhooks

---

## Índice

1. [Contexto Geral](#contexto-geral)
2. [Arquitetura do NossoCRM (Upstream)](#arquitetura-do-nossocrm-upstream)
3. [Spec do Upstream vs Nossa Abordagem](#spec-do-upstream-vs-nossa-abordagem)
4. [Premissa: Fork-Safe Development](#premissa-fork-safe-development)
5. [Fases de Implementação](#fases-de-implementação)
   - [Fase 1: Auditoria e Preparação](#fase-1-auditoria-e-preparação)
   - [Fase 2: Design da Integração Chatwoot](#fase-2-design-da-integração-chatwoot)
   - [Fase 3: Implementação](#fase-3-implementação)
   - [Fase 4: Sistema de Labels Sync](#fase-4-sistema-de-labels-sync)
   - [Fase 5: Decisão Arquitetural](#fase-5-decisão-arquitetural)
   - [Fase 6: Documentação](#fase-6-documentação)
6. [Variáveis de Ambiente](#variáveis-de-ambiente)
7. [Checklist de Compliance](#checklist-de-compliance)

---

## Contexto Geral

Este plano é para o **LagostaCRM**, um fork do [NossoCRM](https://github.com/thaleslaray/nossocrm) com customizações de mensageria. O NossoCRM já possui uma **spec oficial para Unified Messaging Inbox** (`.specswarm/features/001-unified-messaging-inbox/spec.md`) que define Business Units, Canais, Conversas e Inbox Unificado. No entanto, essa spec assume provedores como Z-API e ainda não foi implementada.

### Nossa Abordagem

**Já temos Chatwoot + Evolution API em produção** gerenciando a mensageria via n8n. O objetivo é integrar essa stack existente ao NossoCRM de forma que:

1. **Não conflite com o upstream** (NossoCRM main) — todas as mudanças ficam em branch separada
2. **Aproveite a arquitetura existente** do NossoCRM (patterns, conventions, query keys, realtime)
3. **Use o Chatwoot como backend de mensageria** ao invés de implementar tudo do zero

### Stack Atual em Produção

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FLUXO ATUAL (JÁ FUNCIONA)                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [WhatsApp] → [Evolution API] → [Chatwoot] → [Webhook] → [n8n]          │
│                                      │                      │            │
│                                      │                      ↓            │
│                                      │              [LagostaCRM API]     │
│                                      │                      │            │
│                                      ↓                      ↓            │
│                              [Interface de Chat]    [Deals/Contacts]     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Arquitetura do NossoCRM (Upstream)

### Stack & Patterns

| Tecnologia | Uso |
|------------|-----|
| **Next.js 16** | App Router |
| **React 19** | UI Framework |
| **TypeScript 5.x** | Strict mode |
| **Supabase** | Auth + Postgres + RLS |
| **TanStack Query** | State management com facades em `context/` |
| **Supabase Realtime** | Sync em tempo real |
| **Radix UI + Tailwind v4** | UI Components |
| **AI SDK v6** | Multi-provider (Google, OpenAI, Anthropic) |
| **Vitest** | Testing |

### Estrutura de Pastas Relevante

```
nossocrm/
├── app/                          # Next.js App Router
│   ├── (protected)/              # Rotas autenticadas
│   └── api/                      # API Routes
├── features/                     # Módulos por domínio ← NOSSO CÓDIGO VAI AQUI
│   ├── activities/
│   ├── boards/
│   ├── contacts/
│   ├── dashboard/
│   ├── deals/
│   ├── inbox/                    # Inbox EXISTENTE (briefing de IA, NÃO messaging)
│   ├── reports/
│   └── settings/
├── components/                   # Componentes compartilhados
├── context/                      # React contexts (facades sobre TanStack Query)
├── hooks/                        # Hooks globais
├── lib/                          # Bibliotecas e utilitários
│   ├── query/                    # TanStack Query keys + hooks
│   │   ├── queryKeys.ts          # Keys centralizadas
│   │   └── hooks/                # useDealsQuery, useContactsQuery, etc
│   ├── realtime/                 # Supabase Realtime sync
│   ├── supabase/                 # Clients (client/server/service-role)
│   └── ai/                       # AI tools e integração
├── supabase/
│   └── migrations/               # Schema SQL (PostgreSQL)
├── types/                        # TypeScript types globais
└── .specswarm/features/          # Specs de features planejadas
    └── 001-unified-messaging-inbox/  # Spec do messaging (NÃO implementada)
```

### Tabelas Existentes (Schema Relevante)

| Tabela | Descrição | Relevância |
|--------|-----------|------------|
| `organizations` | Multi-tenancy com RLS | ✅ Usar para isolamento |
| `profiles` | Usuários (extends auth.users) | ✅ Atribuição de conversas |
| `contacts` | Contatos do CRM | ✅ **Tem campo `phone` para matching** |
| `deals` | Oportunidades (tem `tags TEXT[]`) | ✅ Vincular conversas a deals |
| `boards` / `board_stages` | Kanban pipelines | ✅ Agrupador (substitui Business Units) |
| `activities` | Tarefas e atividades | ✅ Registrar interações |
| `tags` | Sistema de tags | ✅ Sincronizar com labels WhatsApp |
| `integration_outbound_endpoints` | Webhooks outbound | ✅ Para notificar n8n de mudanças |

> ⚠️ **NÃO EXISTEM** tabelas de messaging/WhatsApp/channels no schema atual

### Colunas Importantes do Schema

| Tabela | Coluna | Nota |
|--------|--------|------|
| `board_stages` | `label` | Display name (ex: "Em Atendimento") — usar este! |
| `board_stages` | `name` | Identificador interno (fallback) |
| `integration_outbound_endpoints` | `events TEXT[]` | Array de eventos (NÃO `event_type`) |
| `integration_outbound_endpoints` | `active BOOLEAN` | Status (NÃO `is_active`) |

### Patterns de RLS do NossoCRM

O NossoCRM usa **dois padrões** de RLS (Row Level Security):

**Padrão A — Tabelas de dados gerais** (deals, contacts, boards, tags):
```sql
-- RLS aberto para todos autenticados (single-tenant por deployment)
CREATE POLICY "Enable all access for authenticated users"
    ON public.tabela FOR ALL TO authenticated
    USING (true) WITH CHECK (true);
```

**Padrão B — Tabelas admin-only** (integration_outbound_endpoints, ai_prompts):
```sql
-- Admins gerenciam, membros apenas lêem
CREATE POLICY "Admins can manage X" ON public.tabela
    FOR ALL TO authenticated
    USING (
        auth.uid() IN (
            SELECT id FROM public.profiles
            WHERE organization_id = tabela.organization_id
            AND role = 'admin'
        )
    );

CREATE POLICY "Members can view X" ON public.tabela
    FOR SELECT TO authenticated
    USING (
        auth.uid() IN (
            SELECT id FROM public.profiles
            WHERE organization_id = tabela.organization_id
        )
    );
```

> ⚠️ **NÃO EXISTE** função `current_user_organization()` no NossoCRM!

### Função de Updated_at

```sql
-- A função se chama update_updated_at_column() (NÃO set_updated_at)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Query Keys Pattern

```typescript
// lib/query/queryKeys.ts
export const queryKeys = {
    deals: createQueryKeys('deals'),
    contacts: createExtendedQueryKeys('contacts', base => ({...})),
    boards: createQueryKeys('boards'),
    activities: createExtendedQueryKeys('activities', base => ({...})),
    dashboard: { stats, funnel, timeline },
};
```

### Inbox Existente (features/inbox/)

> ⚠️ **IMPORTANTE**: O inbox atual do NossoCRM é um **briefing diário de IA** — NÃO é messaging.

Contém:
- `InboxPage.tsx` — página de briefing
- `InboxBriefing.tsx`, `InboxFocusView.tsx` — componentes de análise de deals com IA
- `MessageComposerModal.tsx` — draft de emails/mensagens (não WhatsApp real)
- `useInboxController.ts` — lógica do briefing

**Este inbox NÃO deve ser modificado.** Nossa feature de messaging será separada.

---

## Spec do Upstream vs Nossa Abordagem

O NossoCRM tem uma spec em `.specswarm/features/001-unified-messaging-inbox/spec.md` que define:
- **Business Units** — agrupamento de canais, boards e config de IA
- **Canais** — conexão com provedores (Z-API como MVP)
- **Conversas** — threads de mensagens com contatos
- **Inbox Unificado** — interface para visualizar/responder

### Tabela Comparativa

| Aspecto | Spec Upstream | Nossa Abordagem |
|---------|--------------|-----------------|
| **Provedor** | Z-API (direto) | Chatwoot + Evolution API (já em produção) |
| **Backend de messaging** | Supabase tables + webhooks | Chatwoot API (messaging) + Supabase (sync) |
| **Processamento** | Tudo no Next.js | n8n orquestra → Chatwoot → webhook → CRM |
| **Chat UI** | Custom no CRM | Chatwoot como UI principal OU chat leve no CRM via API |
| **Labels/Tags** | Custom | Trigger auto-tag + n8n processa `deal.stage_changed` |
| **Business Units** | Nova entidade | NÃO implementar agora — usar boards como agrupador |
| **IA no chat** | Futuro (fase 4) | Já funciona via n8n (agente move deals) |

---

## Premissa: Fork-Safe Development

**TODAS as mudanças devem ser em branch separada** (ex: `feature/chatwoot-messaging`) para que seja possível fazer sync fork com o upstream `thaleslaray/nossocrm` sem conflitos.

### Regras de Ouro

| Regra | Descrição |
|-------|-----------|
| 🚫 **NUNCA modificar arquivos existentes do upstream** | Apenas adicionar novos |
| ✅ **Criar módulo isolado** | `features/messaging/` (NÃO alterar `features/inbox/`) |
| ✅ **Novas tabelas** | Migration separada (novo arquivo em `supabase/migrations/`) |
| ⚠️ **Novas query keys** | Via spread no `queryKeys.ts` (única exceção — mínima e merge-safe) |
| ✅ **Novas rotas API** | `app/api/messaging/` (novo diretório) |
| ✅ **Novas variáveis de ambiente** | Prefixo `CHATWOOT_` (adicionadas ao `.env.example`) |

---

## Fases de Implementação

### Fase 1: Auditoria e Preparação

**Objetivo**: Entender o estado atual e mapear pontos de integração.

#### Tarefas

- [ ] **1.1** Ler a spec upstream completa:
  - `.specswarm/features/001-unified-messaging-inbox/spec.md`
  - `.specswarm/features/001-unified-messaging-inbox/checklists/requirements.md`

- [ ] **1.2** Analisar o schema SQL existente:
  - `supabase/migrations/20251201000000_schema_init.sql`
  - Identificar a tabela `contacts` (campo `phone` para matching)
  - Identificar `deals` + `board_stages` (para vincular conversas)
  - Identificar `board_stages.label` (usado para display, não `name`)
  - Identificar `deals.tags TEXT[]` (para auto-tagging)
  - Identificar `tags` (para sincronizar com labels do WhatsApp)
  - Identificar `integration_outbound_endpoints` (colunas `events[]` e `active`)
  - Identificar trigger `trg_notify_deal_stage_changed` (já existente!)

- [ ] **1.3** Analisar os patterns existentes:
  - `lib/query/queryKeys.ts` — como adicionar novas query keys
  - `lib/query/hooks/useDealsQuery.ts` — padrão de hooks de query
  - `lib/realtime/` — como integrar realtime sync
  - `context/deals/` — padrão de context facades
  - `AGENTS.md` — regras de cache (CRÍTICO)

- [ ] **1.4** Verificar referências WhatsApp/WPPConnect:
  ```bash
  grep -r "wppconnect\|whatsapp\|wpp_connect\|WPPCONNECT" --include="*.ts" --include="*.tsx" .
  ```

- [ ] **1.5** Documentar relatório de auditoria:
  - Criar `.context/audits/messaging-audit.md`

#### Entregável

Relatório de auditoria documentando:
- Estado atual do schema
- Patterns a seguir (especialmente RLS e função `update_updated_at_column`)
- Pontos de integração identificados
- Trigger existente `trg_notify_deal_stage_changed` (reusar para labels!)
- Componentes WPPConnect existentes (se houver)

---

### Fase 2: Design da Integração Chatwoot

**Objetivo**: Decidir a arquitetura da integração.

#### Decisão de SDK: Fetch Direto vs SDK

Após análise, **recomendamos usar fetch direto** ao invés de SDK porque:

1. A API do Chatwoot é simples (REST)
2. Evita dependência externa com breaking changes
3. Tipagem manual dá mais controle
4. SDKs disponíveis têm APIs inconsistentes

**Alternativa**: Se preferir SDK, usar `@figuro/chatwoot-sdk` com a API correta:

```typescript
// ⚠️ API CORRETA do @figuro/chatwoot-sdk
import ChatwootClient from "@figuro/chatwoot-sdk";

const client = new ChatwootClient({
    config: {
        basePath: "https://chatwoot.example.com",
        with_credentials: true,
        credentials: "include",
        token: "<CHATWOOT_API_TOKEN>"
    }
});

// Chamadas usam accountId como parâmetro:
client.conversations.list({ accountId: 1 });
client.messages.create({ accountId: 1, conversationId: 8, data: { content: "Hello" } });
```

#### Arquitetura Proposta

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          ARQUITETURA PROPOSTA                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [WhatsApp] → [Evolution API] → [Chatwoot] → [Webhook n8n] → [n8n]      │
│                                      │                          │        │
│                                      ↓                          ↓        │
│                              [Chatwoot API] ←───────→ [LagostaCRM API]   │
│                                      │                          │        │
│                                      ↓                          ↓        │
│                              [Chat no Chatwoot]    [features/messaging/] │
│                                                    [lib/chatwoot/]       │
│                                                    [app/api/messaging/]  │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    FLUXO DE LABELS SYNC (SIMPLIFICADO)           │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │ Deal muda stage → Trigger auto-tag → trg_notify_deal_stage_changed │  │
│  │                                              ↓                     │  │
│  │                              n8n recebe deal.stage_changed         │  │
│  │                                              ↓                     │  │
│  │                    n8n busca messaging_label_map → aplica labels   │  │
│  │                               ↓                    ↓               │  │
│  │                        Chatwoot Labels      WPP Labels             │  │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Decisão: Reusar Trigger Existente

> ⚠️ **IMPORTANTE**: O NossoCRM já tem `trg_notify_deal_stage_changed` que dispara webhook `deal.stage_changed` quando um deal muda de stage. **NÃO vamos criar um trigger separado para labels.**

O n8n receberá `deal.stage_changed` e:
1. Consultará `messaging_label_map` para saber qual label aplicar
2. Aplicará labels no Chatwoot e WhatsApp
3. Registrará em `messaging_label_sync_log`

Isso evita webhooks duplicados e simplifica a arquitetura.

#### Estrutura de Arquivos Novos

```
lib/chatwoot/
├── client.ts              # Chatwoot API client (fetch direto, tipado)
├── types.ts               # Types do Chatwoot (Conversation, Message, Contact)
├── config.ts              # Busca config da org no banco
└── webhooks.ts            # Processamento de webhooks do Chatwoot

features/messaging/
├── MessagingPage.tsx       # Página principal do inbox de messaging
├── components/
│   ├── ConversationList.tsx    # Lista de conversas
│   ├── ConversationView.tsx    # View de uma conversa (mensagens)
│   ├── ConversationTimeline.tsx # Timeline read-only para deals/contacts
│   ├── MessageInput.tsx        # Input de envio de mensagem
│   ├── ContactSidebar.tsx      # Sidebar com dados do contato/deal
│   └── ConversationFilters.tsx # Filtros (canal, status, etc)
├── hooks/
│   ├── useConversations.ts     # Hook para listar conversas (Chatwoot API)
│   ├── useMessages.ts          # Hook para mensagens de uma conversa
│   ├── useConversationLinks.ts # Hook para conversation_links do Supabase
│   └── useSendMessage.ts       # Hook para enviar mensagem
└── context/
    └── MessagingContext.tsx     # Context facade para messaging

app/api/messaging/
├── conversations/
│   └── route.ts           # Proxy para Chatwoot API (lista/cria conversas)
├── messages/
│   └── route.ts           # Proxy para envio de mensagens
├── webhook/
│   └── route.ts           # Recebe webhooks do Chatwoot (sync com CRM)
└── contacts/
    └── sync/
        └── route.ts       # Sincroniza contatos Chatwoot ↔ CRM

app/(protected)/messaging/
└── page.tsx               # Rota da página de messaging

supabase/migrations/
└── 20260213000000_messaging_sync.sql  # Tabelas de sync + auto-tag trigger

lib/wppconnect/
└── labels.ts              # ÚNICO arquivo WPPConnect — sync de labels
```

---

### Fase 3: Implementação

**Seguir rigorosamente os patterns do NossoCRM.**

#### 3.1 Query Keys (merge-safe via spread)

```typescript
// lib/query/queryKeys.ts
// Adicionar ao objeto existente:
messaging: createExtendedQueryKeys('messaging', base => ({
    conversations: (filters?: MessagingFilters) =>
        [...base.all, 'conversations', filters] as const,
    messages: (conversationId: string) =>
        [...base.all, 'messages', conversationId] as const,
    conversationLinks: (contactId?: string, dealId?: string) =>
        [...base.all, 'links', { contactId, dealId }] as const,
})),
```

#### 3.2 Chatwoot Client (Fetch Direto, Tipado)

```typescript
// lib/chatwoot/client.ts
import { ChatwootConfig, Conversation, Message, ChatwootContact } from './types';

export class ChatwootClient {
    private baseUrl: string;
    private token: string;
    private accountId: number;

    constructor(config: ChatwootConfig) {
        this.baseUrl = config.baseUrl;
        this.token = config.token;
        this.accountId = config.accountId;
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${this.baseUrl}/api/v1/accounts/${this.accountId}${endpoint}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'api_access_token': this.token,
                ...options.headers,
            },
        });

        if (!response.ok) {
            throw new Error(`Chatwoot API error: ${response.status}`);
        }

        return response.json();
    }

    async getConversations(params?: {
        status?: 'open' | 'resolved' | 'pending';
        inbox_id?: number;
        page?: number;
    }): Promise<{ data: { payload: Conversation[] } }> {
        const query = new URLSearchParams(params as Record<string, string>);
        return this.request(`/conversations?${query}`);
    }

    async getMessages(conversationId: number): Promise<{ payload: Message[] }> {
        return this.request(`/conversations/${conversationId}/messages`);
    }

    async sendMessage(
        conversationId: number,
        content: string,
        messageType: 'outgoing' | 'incoming' = 'outgoing'
    ): Promise<Message> {
        return this.request(`/conversations/${conversationId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ content, message_type: messageType }),
        });
    }

    async addLabels(conversationId: number, labels: string[]): Promise<void> {
        await this.request(`/conversations/${conversationId}/labels`, {
            method: 'POST',
            body: JSON.stringify({ labels }),
        });
    }

    async getContact(contactId: number): Promise<ChatwootContact> {
        return this.request(`/contacts/${contactId}`);
    }
}

// Factory que busca config da organização
export async function createChatwootClientForOrg(
    supabase: SupabaseClient,
    organizationId: string
): Promise<ChatwootClient> {
    const { data: config, error } = await supabase
        .from('messaging_channel_configs')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'active')
        .single();

    if (error || !config) {
        throw new Error('No active Chatwoot config found for organization');
    }

    return new ChatwootClient({
        baseUrl: config.chatwoot_base_url,
        token: config.chatwoot_api_token,
        accountId: config.chatwoot_account_id,
    });
}
```

#### 3.3 API Routes (Proxy Multi-Tenant)

> ⚠️ O CRM busca credenciais do Chatwoot pela organização do usuário.

```typescript
// app/api/messaging/conversations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createChatwootClientForOrg } from '@/lib/chatwoot/client';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    const supabase = await createSupabaseServerClient();

    // 1. Auth do usuário
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Buscar org do usuário
    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) {
        return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    // 3. Criar client com credenciais da org
    try {
        const chatwoot = await createChatwootClientForOrg(
            supabase,
            profile.organization_id
        );

        // 4. Buscar conversas
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') as 'open' | 'resolved' | undefined;

        const conversations = await chatwoot.getConversations({ status });

        return NextResponse.json(conversations.data.payload);
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to fetch conversations' },
            { status: 500 }
        );
    }
}
```

#### 3.4 Realtime Sync

> Usar Supabase Realtime para sync, NÃO WebSocket do Chatwoot.

```
Webhook Chatwoot → /api/messaging/webhook → Upsert em messaging_conversation_links
                                                    ↓
                                          Supabase Realtime → Client
```

```typescript
// Hook para realtime sync de conversation links
// features/messaging/hooks/useConversationLinks.ts
import { useRealtimeSync } from '@/lib/realtime';
import { queryKeys } from '@/lib/query/queryKeys';

export function useConversationLinks(contactId?: string, dealId?: string) {
    const queryKey = queryKeys.messaging.conversationLinks(contactId, dealId);

    // Supabase realtime sync
    useRealtimeSync({
        table: 'messaging_conversation_links',
        filter: contactId
            ? `contact_id=eq.${contactId}`
            : dealId
            ? `deal_id=eq.${dealId}`
            : undefined,
        queryKey,
    });

    return useQuery({
        queryKey,
        queryFn: async () => {
            // ... fetch from supabase
        },
    });
}
```

#### 3.5 Migration de Tabelas de Sync (v1.2 Corrigida)

> ⚠️ **Todas as correções aplicadas:**
> - `COALESCE(bs.label, bs.name)` para pegar display name correto
> - Coluna `chatwoot_url` é TEXT simples (não GENERATED)
> - Triggers usam `update_updated_at_column()` (nome correto)
> - SEM trigger duplicado para labels — reusar `trg_notify_deal_stage_changed`

```sql
-- supabase/migrations/20260213000000_messaging_sync.sql

-- ============================================================================
-- TABELA: messaging_channel_configs
-- Configurações de canais conectados (Chatwoot + WPPConnect)
-- RLS: Padrão B (admin gerencia, membros lêem)
-- ============================================================================
CREATE TABLE public.messaging_channel_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Chatwoot
    chatwoot_base_url TEXT NOT NULL,
    chatwoot_api_token TEXT NOT NULL,
    chatwoot_account_id INTEGER NOT NULL,
    chatwoot_inbox_id INTEGER,

    -- WPPConnect (para labels sync)
    wppconnect_base_url TEXT,
    wppconnect_token TEXT,
    wppconnect_session TEXT,

    -- Metadata
    channel_type TEXT DEFAULT 'whatsapp',
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_mcc_org_status ON public.messaging_channel_configs(organization_id, status);

-- RLS (Padrão B - Admin only para gerenciar)
ALTER TABLE public.messaging_channel_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage channel configs"
    ON public.messaging_channel_configs
    FOR ALL TO authenticated
    USING (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = messaging_channel_configs.organization_id
            AND p.role = 'admin'
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = messaging_channel_configs.organization_id
            AND p.role = 'admin'
        )
    );

CREATE POLICY "Members can view channel configs"
    ON public.messaging_channel_configs
    FOR SELECT TO authenticated
    USING (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = messaging_channel_configs.organization_id
        )
    );

-- ============================================================================
-- TABELA: messaging_conversation_links
-- Vinculação CRM ↔ Chatwoot (com preview para timeline)
-- RLS: Padrão A (todos autenticados)
-- ============================================================================
CREATE TABLE public.messaging_conversation_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- IDs do Chatwoot
    chatwoot_conversation_id INTEGER NOT NULL,
    chatwoot_contact_id INTEGER,
    chatwoot_inbox_id INTEGER,

    -- Vinculação com CRM
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,

    -- Preview para timeline (evita chamadas à API do Chatwoot)
    last_message_at TIMESTAMPTZ,
    last_message_preview TEXT,              -- "Boa tarde, gostaria de reservar..."
    last_message_sender TEXT,               -- "customer" | "agent"
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'pending')),
    unread_count INTEGER DEFAULT 0,

    -- Deep link para abrir no Chatwoot (preenchido pela aplicação/webhook)
    chatwoot_url TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id, chatwoot_conversation_id)
);

-- Índices de performance
CREATE INDEX idx_mcl_org ON public.messaging_conversation_links(organization_id);
CREATE INDEX idx_mcl_contact ON public.messaging_conversation_links(contact_id)
    WHERE contact_id IS NOT NULL;
CREATE INDEX idx_mcl_deal ON public.messaging_conversation_links(deal_id)
    WHERE deal_id IS NOT NULL;

-- Índices compostos para timeline queries
CREATE INDEX idx_mcl_contact_last_msg
    ON public.messaging_conversation_links(contact_id, last_message_at DESC)
    WHERE contact_id IS NOT NULL;

CREATE INDEX idx_mcl_deal_last_msg
    ON public.messaging_conversation_links(deal_id, last_message_at DESC)
    WHERE deal_id IS NOT NULL;

-- Índice para buscar conversas abertas
CREATE INDEX idx_mcl_status_open
    ON public.messaging_conversation_links(organization_id, status)
    WHERE status = 'open';

-- RLS (Padrão A - Todos autenticados)
ALTER TABLE public.messaging_conversation_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users"
    ON public.messaging_conversation_links
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- TABELA: messaging_label_map
-- Mapeamento: Tag CRM ↔ Label Chatwoot ↔ Label WhatsApp
-- RLS: Padrão B (admin gerencia, membros lêem)
-- ============================================================================
CREATE TABLE public.messaging_label_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Identificadores
    crm_tag_name TEXT NOT NULL,             -- Nome da tag no CRM (ex: "em-atendimento")
    chatwoot_label TEXT NOT NULL,           -- Label no Chatwoot (ex: "em_atendimento")
    whatsapp_label TEXT,                    -- Label no WhatsApp via WPPConnect (pode ser diferente)

    -- Vinculação com stage (opcional - para auto-tag)
    board_stage_id UUID REFERENCES public.board_stages(id) ON DELETE SET NULL,

    -- Cor para consistência visual
    color TEXT DEFAULT '#6B7280',

    -- Direção de sync
    sync_to_chatwoot BOOLEAN DEFAULT true,
    sync_to_whatsapp BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id, crm_tag_name)
);

-- Índices
CREATE INDEX idx_mlm_org ON public.messaging_label_map(organization_id);
CREATE INDEX idx_mlm_stage ON public.messaging_label_map(board_stage_id)
    WHERE board_stage_id IS NOT NULL;

-- RLS (Padrão B - Admin only para gerenciar)
ALTER TABLE public.messaging_label_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage label mappings"
    ON public.messaging_label_map
    FOR ALL TO authenticated
    USING (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = messaging_label_map.organization_id
            AND p.role = 'admin'
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = messaging_label_map.organization_id
            AND p.role = 'admin'
        )
    );

CREATE POLICY "Members can view label mappings"
    ON public.messaging_label_map
    FOR SELECT TO authenticated
    USING (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = messaging_label_map.organization_id
        )
    );

-- ============================================================================
-- TABELA: messaging_label_sync_log
-- Auditoria de sincronizações de labels
-- RLS: Padrão A (todos autenticados podem ler)
-- ============================================================================
CREATE TABLE public.messaging_label_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Contexto
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    conversation_link_id UUID REFERENCES public.messaging_conversation_links(id) ON DELETE SET NULL,

    -- Ação
    action TEXT NOT NULL CHECK (action IN ('add_label', 'remove_label', 'sync_error')),
    label_name TEXT NOT NULL,
    target TEXT NOT NULL CHECK (target IN ('chatwoot', 'whatsapp', 'crm')),

    -- Resultado
    success BOOLEAN DEFAULT true,
    error_message TEXT,

    -- Metadata
    triggered_by TEXT,                      -- 'stage_change' | 'manual' | 'webhook'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_mlsl_org_created ON public.messaging_label_sync_log(organization_id, created_at DESC);
CREATE INDEX idx_mlsl_deal ON public.messaging_label_sync_log(deal_id) WHERE deal_id IS NOT NULL;

-- RLS (Padrão A)
ALTER TABLE public.messaging_label_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users"
    ON public.messaging_label_sync_log
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- TRIGGER: Auto-tag deal quando muda de stage
-- Adiciona a tag correspondente ao stage no deals.tags[]
-- NOTA: Usa COALESCE(label, name) para pegar o display name correto
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_auto_tag_deal_on_stage_change()
RETURNS TRIGGER AS $$
DECLARE
    v_stage_display TEXT;
    v_label_map RECORD;
BEGIN
    -- Só executa se stage_id mudou
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id AND NEW.stage_id IS NOT NULL THEN

        -- Buscar display name do stage (label com fallback para name)
        SELECT COALESCE(bs.label, bs.name) INTO v_stage_display
        FROM public.board_stages bs
        WHERE bs.id = NEW.stage_id;

        -- Buscar mapeamento de label para este stage
        SELECT * INTO v_label_map
        FROM public.messaging_label_map
        WHERE board_stage_id = NEW.stage_id
        LIMIT 1;

        -- Se existe mapeamento, adicionar tag ao deal
        IF v_label_map.id IS NOT NULL THEN
            -- Adicionar tag se não existe
            IF NOT (NEW.tags @> ARRAY[v_label_map.crm_tag_name]) THEN
                NEW.tags := array_append(COALESCE(NEW.tags, ARRAY[]::TEXT[]), v_label_map.crm_tag_name);
            END IF;
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger BEFORE UPDATE (para modificar NEW.tags)
DROP TRIGGER IF EXISTS trg_auto_tag_deal_on_stage ON public.deals;
CREATE TRIGGER trg_auto_tag_deal_on_stage
    BEFORE UPDATE ON public.deals
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_auto_tag_deal_on_stage_change();

-- ============================================================================
-- NÃO CRIAR TRIGGER SEPARADO PARA LABELS!
-- O trigger existente trg_notify_deal_stage_changed já envia webhook
-- deal.stage_changed que o n8n usa para aplicar labels.
-- Isso evita webhooks duplicados.
-- ============================================================================

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- NOTA: Usa update_updated_at_column() (nome correto da função no NossoCRM)
-- ============================================================================
CREATE TRIGGER set_updated_at_messaging_channel_configs
    BEFORE UPDATE ON public.messaging_channel_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_messaging_conversation_links
    BEFORE UPDATE ON public.messaging_conversation_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_messaging_label_map
    BEFORE UPDATE ON public.messaging_label_map
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

### Fase 4: Sistema de Labels Sync

**Objetivo**: Sincronizar tags/labels entre CRM, Chatwoot e WhatsApp automaticamente.

#### Fluxo Completo (Simplificado)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                 FLUXO DE LABELS SYNC (v1.2 SIMPLIFICADO)                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. Deal muda de stage no CRM (drag & drop no Kanban)                   │
│                    ↓                                                     │
│  2. Trigger `trg_auto_tag_deal_on_stage` (BEFORE UPDATE)                │
│     - Busca mapeamento em `messaging_label_map`                         │
│     - Adiciona tag ao `deals.tags[]`                                    │
│                    ↓                                                     │
│  3. Trigger EXISTENTE `trg_notify_deal_stage_changed` (AFTER UPDATE)    │
│     - Já existe no NossoCRM!                                            │
│     - Envia webhook `deal.stage_changed` para endpoints configurados    │
│                    ↓                                                     │
│  4. n8n recebe webhook `deal.stage_changed`                             │
│     - Payload inclui: deal.id, deal.stage_id, deal.tags, contact info   │
│     - n8n consulta `messaging_label_map` via API                        │
│     - Aplica label no Chatwoot (API)                                    │
│     - Aplica label no WhatsApp (WPPConnect)                             │
│     - Registra em `messaging_label_sync_log` via API                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Por que NÃO criar trigger separado?

1. **Evita webhooks duplicados**: Um `deal.stage_changed` já é suficiente
2. **Menos complexidade**: Não precisa gerenciar dois triggers
3. **n8n já sabe o stage**: Pode buscar o mapeamento diretamente
4. **Consistência**: Usa a mesma infraestrutura do NossoCRM

#### Configuração de Mapeamento

Exemplo de dados em `messaging_label_map`:

| crm_tag_name | chatwoot_label | whatsapp_label | board_stage_id |
|--------------|----------------|----------------|----------------|
| `nova-interacao` | `nova_interacao` | `Nova Interação` | `uuid-stage-1` |
| `em-atendimento` | `em_atendimento` | `Em Atendimento` | `uuid-stage-2` |
| `aguardando-cliente` | `aguardando_cliente` | `Aguardando Cliente` | `uuid-stage-3` |
| `finalizado` | `finalizado` | `Finalizado` | `uuid-stage-6` |

#### API para Gerenciar Mapeamentos

```typescript
// app/api/messaging/labels/route.ts
export async function GET(request: NextRequest) {
    // Lista mapeamentos da org
    // Inclui: crm_tag_name, chatwoot_label, whatsapp_label, board_stage_id
}

export async function POST(request: NextRequest) {
    // Cria novo mapeamento (admin only)
}

export async function PUT(request: NextRequest) {
    // Atualiza mapeamento (admin only)
}

// app/api/messaging/labels/sync-log/route.ts
export async function POST(request: NextRequest) {
    // n8n registra resultado da sincronização
    // Body: { deal_id, action, label_name, target, success, error_message }
}
```

#### Workflow n8n Atualizado

O workflow n8n para labels sync deve:

1. **Trigger**: Webhook recebe `deal.stage_changed`
2. **Buscar mapeamento**: GET `/api/messaging/labels?stage_id=xxx`
3. **Buscar conversation**: GET `/api/messaging/conversation-links?deal_id=xxx`
4. **Aplicar no Chatwoot**: POST labels via Chatwoot API
5. **Aplicar no WhatsApp**: POST labels via WPPConnect API
6. **Registrar log**: POST `/api/messaging/labels/sync-log`

---

### Fase 5: Decisão Arquitetural

**Chat no CRM vs Dashboard App — análise de opções.**

#### Opção A: Chat Embutido no CRM

**Descrição**: Interface completa de chat em `features/messaging/`

| Prós | Contras |
|------|---------|
| UX integrada | Mais código para manter |
| Dados do CRM ao lado do chat | Duplica UI que Chatwoot já tem |
| Controle total da experiência | Maior complexidade |

#### Opção B: Dashboard App do Chatwoot

**Descrição**: Embutir mini-view do CRM como aba no Chatwoot

| Prós | Contras |
|------|---------|
| Menos código no CRM | Dependência visual do Chatwoot |
| Chatwoot já resolve chat | Menos integrado |
| Atendentes já conhecem | Customização limitada |

#### Opção C: Híbrido (⭐ Recomendada)

**Descrição**: Chat principal no Chatwoot + timeline read-only no CRM

| Prós | Contras |
|------|---------|
| Melhor dos dois mundos | Complexidade moderada |
| Atendentes usam Chatwoot | Duas interfaces para gerenciar |
| CRM mostra contexto relevante | — |
| Link rápido para abrir no Chatwoot | — |

**Implementação Recomendada**:

1. **Chatwoot**: Interface principal de chat (atendentes)
2. **CRM** (`features/messaging/`):
   - Timeline de conversas read-only no deal/contato
   - Resumo das últimas mensagens (via `last_message_preview`)
   - Status da conversa (open/resolved) e unread count
   - Link "Abrir no Chatwoot" para conversa completa (via `chatwoot_url`)
   - Indicador de conversas não lidas

#### Componente ConversationTimeline

```typescript
// features/messaging/components/ConversationTimeline.tsx
interface ConversationTimelineProps {
    contactId?: string;
    dealId?: string;
}

export function ConversationTimeline({ contactId, dealId }: ConversationTimelineProps) {
    const { data: links, isLoading } = useConversationLinks(contactId, dealId);

    if (isLoading) return <Skeleton />;
    if (!links?.length) return <EmptyState message="Nenhuma conversa" />;

    return (
        <div className="space-y-3">
            {links.map((link) => (
                <ConversationCard
                    key={link.id}
                    status={link.status}
                    lastMessage={link.last_message_preview}
                    lastMessageAt={link.last_message_at}
                    unreadCount={link.unread_count}
                    onOpenInChatwoot={() => window.open(link.chatwoot_url, '_blank')}
                />
            ))}
        </div>
    );
}
```

---

### Fase 6: Documentação

#### Arquivos a Criar/Atualizar

| Arquivo | Descrição |
|---------|-----------|
| `.context/integrations/chatwoot/ARCHITECTURE.md` | Arquitetura da integração |
| `.context/integrations/chatwoot/WORKFLOW_DOCUMENTATION.md` | Atualizar o existente |
| `.context/integrations/chatwoot/LABELS_SYNC.md` | Documentação do sistema de labels |
| `.context/integrations/wppconnect/LABELS_ONLY.md` | Documentar que WPPConnect é SÓ para labels |
| `features/messaging/README.md` | Documentação do módulo |
| `AGENTS.md` | Atualizar com regras de cache para messaging |

---

## Variáveis de Ambiente

```env
# --- Chatwoot Integration ---
# Nota: Credenciais principais ficam na tabela messaging_channel_configs
# Estas são fallback/default para desenvolvimento
CHATWOOT_BASE_URL=https://chatwoot-coronel.lagostacriativa.com.br
CHATWOOT_API_TOKEN=               # Application API token (dev only)
CHATWOOT_ACCOUNT_ID=              # Account ID numérico (dev only)
CHATWOOT_WEBHOOK_SECRET=          # Secret para validar webhooks

# --- WPPConnect (APENAS para labels sync) ---
# Nota: Credenciais principais ficam na tabela messaging_channel_configs
WPPCONNECT_BASE_URL=https://seu-wppconnect.com
WPPCONNECT_SECRET_KEY=
WPPCONNECT_SESSION=
```

---

## Checklist de Compliance

### Antes de Cada Commit

- [ ] Nenhum arquivo do upstream foi modificado (exceto `queryKeys.ts` e `.env.example`)
- [ ] Novos arquivos estão em diretórios isolados:
  - `features/messaging/`
  - `lib/chatwoot/`
  - `lib/wppconnect/`
  - `app/api/messaging/`
  - `app/(protected)/messaging/`
- [ ] Nova migration tem timestamp posterior às existentes
- [ ] RLS policies seguem patterns reais do NossoCRM (Padrão A ou B)
- [ ] Triggers usam `update_updated_at_column()` (nome correto)
- [ ] `npm run lint` passa sem warnings
- [ ] `npm run typecheck` passa
- [ ] `npm run test:run` passa (testes existentes não quebram)

### Antes de Merge

- [ ] Branch está atualizada com `main`
- [ ] Documentação atualizada
- [ ] Variáveis de ambiente documentadas no `.env.example`
- [ ] Testes adicionados para novos componentes
- [ ] Mapeamentos de labels configurados em `messaging_label_map`
- [ ] Endpoint de webhook configurado em `integration_outbound_endpoints` com evento `deal.stage_changed`

---

## Cronograma de Execução

| Fase | Descrição | Dependências |
|------|-----------|--------------|
| **Fase 1** | Auditoria e Preparação | — |
| **Fase 2** | Design da Integração | Fase 1 |
| **Fase 3** | Implementação (Tabelas + Client + API) | Fase 2 |
| **Fase 4** | Sistema de Labels Sync | Fase 3 |
| **Fase 5** | Decisão Arquitetural (Timeline UI) | Fase 3 |
| **Fase 6** | Documentação | Fase 4, 5 |

---

## Referências

- [NossoCRM Repository](https://github.com/thaleslaray/nossocrm)
- [Spec Unified Messaging Inbox](.specswarm/features/001-unified-messaging-inbox/spec.md)
- [Chatwoot API Documentation](https://www.chatwoot.com/developers/api)
- [Workflow Atual](./WORKFLOW_DOCUMENTATION.md)

---

## Histórico de Alterações

| Data | Versão | Alteração |
|------|--------|-----------|
| 2026-02-13 | 1.0 | Versão inicial do plano de implementação |
| 2026-02-13 | 1.1 | Correções: RLS patterns reais, Labels Sync completo, colunas preview/status, API correta do SDK, multi-tenancy no proxy, campos WPPConnect, índices de performance |
| 2026-02-13 | 1.2 | Correções finais: `COALESCE(label, name)` para stages, colunas corretas em endpoints (`events[]`, `active`), `chatwoot_url` como TEXT simples, `update_updated_at_column()`, remoção de trigger duplicado para labels (reusar `trg_notify_deal_stage_changed`) |
