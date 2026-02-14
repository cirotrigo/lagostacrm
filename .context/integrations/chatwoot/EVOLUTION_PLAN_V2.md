# Plano de Evolução: Chat Completo Embutido no LagostaCRM

> **Versão:** 2.3
> **Data:** 2026-02-14
> **Status:** Em Implementação
> **Branch:** `project/lagostacrm`
> **Pré-requisito:** Plano v1.1 (Opção C Híbrida) implementado e em produção
> **Última Atualização:** Fase 1.5 e Fase 2 implementadas

---

## Objetivo

Evoluir o LagostaCRM de **timeline read-only** (v1.1) para **chat completo embutido**, tornando o CRM a interface principal de atendimento. O Chatwoot permanece como **backend de mensageria** (recebe/envia via Evolution API), mas atendentes e gestor operam pelo CRM.

---

## 🔴 CRÍTICO: Dois Sistemas de Messaging Coexistindo

### O Problema Identificado

O codebase tem **dois sistemas de messaging em paralelo** que precisam ser unificados:

**Sistema 1 — WPPConnect (legado, migration `20260210`):**
- Tabelas: `whatsapp_sessions`, `whatsapp_conversations`, `whatsapp_messages`, `whatsapp_label_sync`
- API routes: `/api/whatsapp/conversations`, `/api/whatsapp/send`, `/api/whatsapp/session`
- Realtime: `whatsapp_messages`, `whatsapp_conversations`

**Sistema 2 — Chatwoot (novo, migration `20260213`):**
- Tabelas: `messaging_channel_configs`, `messaging_conversation_links`, `messaging_label_map`
- API routes: `/api/chatwoot/conversation-links`, `/api/chatwoot/webhook`, `/api/chatwoot/conversations`
- Webhook handler: `lib/chatwoot/webhooks.ts`

### Hooks de UI Apontam para Sistema Legado

```typescript
// useMessages.ts — APONTA PARA API ANTIGA
fetch(`/api/whatsapp/conversations/${conversationId}/messages?${params}`)

// useMessagingController.ts — ESCUTA TABELAS ANTIGAS
useRealtimeSync('whatsapp_messages', { ... });

// useConversations.ts — APONTA PARA API ANTIGA
fetch(`/api/whatsapp/conversations?${params}`)
```

### Impacto se Não Corrigido

Se a Fase 2 for implementada criando um **terceiro sistema** (`messaging_messages_cache` + novas rotas em `/api/messaging/`):
- `MessagingPage.tsx` não vai funcionar (usa hooks que chamam `/api/whatsapp/`)
- Confusão sobre qual sistema usar
- Código duplicado e difícil de manter

### Decisão: Migrar Hooks para Chatwoot (Fase 1.5)

**ANTES de implementar a Fase 2, executar a Fase 1.5:**

1. Atualizar `useMessages.ts` → chamar `/api/chatwoot/conversations/[id]/messages`
2. Atualizar `useConversations.ts` → chamar `/api/chatwoot/conversations`
3. Atualizar `useMessagingController.ts` → usar realtime de `messaging_conversation_links`
4. Marcar `/api/whatsapp/*` como deprecated
5. Planejar remoção das tabelas `whatsapp_*` em versão futura

---

## Status da Implementação Atual (v1.1)

### ✅ Implementado e Funcionando

| Componente | Arquivo/Tabela | Status |
|------------|----------------|--------|
| **Chatwoot API Client** | `lib/chatwoot/client.ts` | ✅ Implementado |
| **Types do Chatwoot** | `lib/chatwoot/types.ts` | ✅ Implementado |
| **Config por organização** | `lib/chatwoot/config.ts` | ✅ Implementado |
| **Index exports** | `lib/chatwoot/index.ts` | ✅ Implementado |
| **Tabela credenciais** | `messaging_channel_configs` | ✅ Migração aplicada |
| **Tabela conversation links** | `messaging_conversation_links` | ✅ Migração aplicada |
| **Tabela label map** | `messaging_label_map` | ✅ Migração aplicada |
| **Tabela sync log** | `messaging_label_sync_log` | ✅ Migração aplicada |
| **Trigger auto-tag** | `trg_auto_tag_deal_on_stage` | ✅ Migração aplicada |
| **API conversation-links** | `app/api/chatwoot/conversation-links/route.ts` | ✅ GET/POST/PATCH |
| **API sync-log** | `app/api/chatwoot/labels/sync-log/route.ts` | ✅ GET/POST |
| **Hook useConversationLinks** | `features/messaging/chatwoot/hooks/useConversationLinks.ts` | ✅ Implementado |
| **ConversationTimeline** | `features/messaging/chatwoot/components/ConversationTimeline.tsx` | ✅ Implementado |
| **Aba Mensagens no Deal** | `features/boards/components/Modals/DealDetailModal.tsx` | ✅ Adicionado |
| **n8n Workflow** | `Criar_Conversation_Link` node | ✅ Funcionando |
| **Auth API (n8n)** | x-api-key + X-Organization-Id | ✅ Implementado |
| **Static Admin Client** | `lib/supabase/staticAdminClient.ts` | ✅ Implementado |

### ✅ Integrações n8n Funcionando

| Workflow | Funcionalidade | Status |
|----------|---------------|--------|
| **Agente de Atendimento** | Webhook Chatwoot → CRM | ✅ Funcionando |
| **Criar_Conversation_Link** | Vincula conversa ao deal | ✅ Funcionando |
| **Deal Stage Label Sync** | Sync labels quando deal muda | ✅ Configurado |

### 🔄 Parcialmente Implementado

| Componente | O que existe | O que falta |
|------------|-------------|-------------|
| **ConversationTimeline** | Exibe conversas vinculadas | Não exibe mensagens (só metadata) |
| **Query Keys** | `chatwoot.conversationLinks` | Falta `messages`, `agents` |
| **Webhook handler** | Estrutura básica | Falta processar `message_created` |

### ❌ Não Implementado (Fase 1.5 — Migração para Chatwoot)

| Componente | Descrição |
|------------|-----------|
| **Migrar useMessages.ts** | Trocar `/api/whatsapp/` por `/api/chatwoot/` |
| **Migrar useConversations.ts** | Trocar para usar `messaging_conversation_links` |
| **Migrar useMessagingController.ts** | Trocar realtime de `whatsapp_*` para `messaging_*` |
| **Deprecar rotas WPPConnect** | Marcar `/api/whatsapp/*` como deprecated |
| **Documentar remoção futura** | Plano de cleanup das tabelas `whatsapp_*` |

### ❌ Não Implementado (Fase 2 — Chat Completo)

| Componente | Descrição |
|------------|-----------|
| **messaging_messages_cache** | Tabela para cache de mensagens |
| **messaging_agents** | Tabela para cache de agentes |
| **Enviar mensagens** | Input + API route |
| **Receber em tempo real** | Webhook → Supabase Realtime |
| **Upload de mídia** | Imagens e áudios |
| **Gravação de áudio** | Web Audio API |
| **Notas internas** | Mensagens privadas |
| **Assignment** | Atribuir conversa a agente |
| **Lista de conversas** | Sidebar com todas conversas |
| **Filtros** | Por status, agente, label |
| **ChatView completo** | Interface de chat embutida |

---

## Arquitetura Atual (v1.1)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FLUXO ATUAL (v1.1)                          │
└─────────────────────────────────────────────────────────────────────┘

Cliente envia mensagem no WhatsApp
       │
       ▼
[Evolution API] → [Chatwoot] processa
       │
       └──webhook──► [n8n] Agente de Atendimento
                          │
                          ├─► Busca/Cria contato no CRM
                          ├─► Busca/Cria deal no CRM
                          ├─► Cria conversation_link (vincula ao deal)
                          └─► Processa com IA → Responde no Chatwoot

       ┌────────────────────────────────────────────────────────────┐
       │                    NO CRM (LagostaCRM)                     │
       ├────────────────────────────────────────────────────────────┤
       │                                                            │
       │  Deal Cockpit → Aba "Mensagens"                           │
       │       │                                                    │
       │       ▼                                                    │
       │  ConversationTimeline                                      │
       │       │                                                    │
       │       ▼                                                    │
       │  useConversationLinks({ dealId })                         │
       │       │                                                    │
       │       ▼                                                    │
       │  GET /api/chatwoot/conversation-links?deal_id=xxx         │
       │       │                                                    │
       │       ▼                                                    │
       │  Supabase: messaging_conversation_links                   │
       │       │                                                    │
       │       ▼                                                    │
       │  Exibe: status, última mensagem, link para Chatwoot       │
       │                                                            │
       │  ⚠️ Para ver/enviar mensagens → Abre Chatwoot externo     │
       │                                                            │
       └────────────────────────────────────────────────────────────┘
```

---

## Fase 2: Chat Completo Embutido

### Convenção de Rotas API

Para evitar confusão entre rotas em dois prefixos, adotamos a **Opção C** (separação por consumidor):

| Prefixo | Consumidor | Auth | Propósito |
|---------|-----------|------|-----------|
| `/api/chatwoot/` | n8n, webhooks externos | `x-api-key` + `X-Organization-Id` ou HMAC | Integrações externas |
| `/api/messaging/` | Frontend do CRM | Supabase cookie (session) | UI de chat embutida |

**Rotas existentes (permanecem):**
```
/api/chatwoot/conversation-links   → n8n cria/atualiza links
/api/chatwoot/labels/sync-log      → n8n registra syncs
/api/chatwoot/webhook              → Chatwoot envia eventos (n8n processa)
```

**Rotas novas (Fase 2):**
```
/api/messaging/conversations       → Frontend lista conversas
/api/messaging/conversations/[id]  → Frontend mensagens, assign, status
/api/messaging/agents              → Frontend lista agentes
/api/messaging/webhook             → CRM recebe eventos (realtime cache)
```

### Estratégia de Autenticação por Rota

| Rota | Auth | Como Validar |
|------|------|--------------|
| `POST /api/chatwoot/conversation-links` | x-api-key | `validateAuth()` já implementado |
| `POST /api/chatwoot/webhook` | HMAC | `validateWebhookSignature()` (ver abaixo) |
| `GET /api/messaging/conversations` | Supabase cookie | `createClient()` + `getUser()` |
| `POST /api/messaging/webhook` | HMAC | Mesmo que `/api/chatwoot/webhook` |

**HMAC Webhook Validation (implementar antes de produção):**

```typescript
import { createHmac, timingSafeEqual } from 'crypto';

function validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string
): boolean {
    const expected = createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

    try {
        return timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expected)
        );
    } catch {
        return false;
    }
}
```

### Visão Geral

```
┌─────────────────────────────────────────────────────────────────────┐
│                       FLUXO FUTURO (v2.0)                           │
└─────────────────────────────────────────────────────────────────────┘

                    ENVIO (CRM → Cliente)
                    ─────────────────────
Atendente digita no CRM
       │
       ▼
[ChatView] → MessageInput
       │
       ▼
POST /api/messaging/conversations/[id]/messages
       │
       ▼
[Chatwoot API] → Evolution API → WhatsApp → Cliente


                    RECEBIMENTO (Cliente → CRM)
                    ───────────────────────────
Cliente envia no WhatsApp
       │
       ▼
[Evolution API] → [Chatwoot]
       │
       ├──webhook──► [n8n] (fluxo existente - IA, deals)
       │
       └──webhook──► [CRM] /api/messaging/webhook
                          │
                          ▼
                     Upsert messaging_messages_cache
                          │
                          ▼
                     Supabase Realtime
                          │
                          ▼
                     useMessagingRealtime()
                          │
                          ▼
                     UI atualiza automaticamente
```

### 2.1 Novas Tabelas (Migration)

**Arquivo:** `supabase/migrations/20260215000000_messaging_chat_v2.sql`

```sql
-- =============================================================================
-- Migration: 20260215000000_messaging_chat_v2.sql
-- Chat completo embutido - Fase 2
-- =============================================================================

-- ============================================================================
-- TABELA: messaging_messages_cache
-- Cache local de mensagens para Supabase Realtime
-- Chatwoot continua sendo fonte de verdade
-- RLS: Padrão A (todos autenticados)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.messaging_messages_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    chatwoot_message_id INTEGER NOT NULL,
    chatwoot_conversation_id INTEGER NOT NULL,
    content TEXT,
    content_type TEXT DEFAULT 'text',
    message_type TEXT NOT NULL CHECK (message_type IN ('incoming', 'outgoing', 'activity', 'template')),
    is_private BOOLEAN DEFAULT false,
    attachments JSONB DEFAULT '[]'::jsonb,
    sender_type TEXT,
    sender_id INTEGER,
    sender_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, chatwoot_message_id)
);

-- Indexes
CREATE INDEX idx_mmc_conversation
    ON public.messaging_messages_cache(chatwoot_conversation_id, created_at DESC);
CREATE INDEX idx_mmc_org_conversation
    ON public.messaging_messages_cache(organization_id, chatwoot_conversation_id);

-- RLS (Padrão A)
ALTER TABLE public.messaging_messages_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users"
    ON public.messaging_messages_cache
    FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER set_updated_at_messaging_messages_cache
    BEFORE UPDATE ON public.messaging_messages_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABELA: messaging_agents
-- Cache de agentes Chatwoot mapeados para profiles do CRM
-- RLS: Padrão A (todos autenticados)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.messaging_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    chatwoot_agent_id INTEGER NOT NULL,
    chatwoot_agent_name TEXT,
    availability TEXT DEFAULT 'offline' CHECK (availability IN ('online', 'offline', 'busy')),
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, chatwoot_agent_id)
);

-- Indexes
CREATE INDEX idx_ma_org ON public.messaging_agents(organization_id);

-- RLS (Padrão A)
ALTER TABLE public.messaging_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users"
    ON public.messaging_agents
    FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER set_updated_at_messaging_agents
    BEFORE UPDATE ON public.messaging_agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ALTER: Campos adicionais em messaging_conversation_links
-- ============================================================================
ALTER TABLE public.messaging_conversation_links
    ADD COLUMN IF NOT EXISTS assigned_agent_id INTEGER,
    ADD COLUMN IF NOT EXISTS assigned_agent_name TEXT,
    ADD COLUMN IF NOT EXISTS inbox_name TEXT,
    ADD COLUMN IF NOT EXISTS contact_name TEXT,
    ADD COLUMN IF NOT EXISTS contact_phone TEXT,
    ADD COLUMN IF NOT EXISTS contact_avatar_url TEXT;

-- ============================================================================
-- FUNCTION: increment_unread
-- Incrementa unread_count atomicamente (usado pelo webhook handler)
-- NOTA: Param names devem bater com os nomes usados em webhooks.ts:
--       supabase.rpc('increment_unread', { org_id: ..., conv_id: ... })
-- ============================================================================
CREATE OR REPLACE FUNCTION public.increment_unread(
    org_id UUID,
    conv_id INTEGER
)
RETURNS INTEGER
LANGUAGE sql
AS $$
    UPDATE public.messaging_conversation_links
    SET unread_count = unread_count + 1,
        updated_at = NOW()
    WHERE organization_id = org_id
      AND chatwoot_conversation_id = conv_id
    RETURNING unread_count;
$$;

-- ============================================================================
-- Realtime
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messaging_messages_cache;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messaging_agents;
```

### 2.2 Novas API Routes

```
app/api/messaging/                         # Auth: Supabase cookie (frontend)
├── conversations/
│   ├── route.ts                           # GET (listar conversas)
│   └── [conversationId]/
│       ├── messages/
│       │   └── route.ts                   # GET (histórico) + POST (enviar)
│       ├── assign/
│       │   └── route.ts                   # POST (atribuir agente)
│       ├── status/
│       │   └── route.ts                   # POST (open/resolve/pending)
│       ├── notes/
│       │   └── route.ts                   # POST (nota interna)
│       └── read/
│           └── route.ts                   # POST (reset unread_count)
├── messages/
│   └── upload/
│       └── route.ts                       # POST (upload de mídia)
├── agents/
│   └── route.ts                           # GET (listar agentes)
└── webhook/
    └── route.ts                           # Auth: HMAC - processar message_created
```

### 2.3 Novos Hooks

```
features/messaging/hooks/
├── useSendMessage.ts            # Mutation de envio
├── useAssignConversation.ts     # Mutation de assignment
├── useToggleStatus.ts           # Mutation open/resolve
├── useAgents.ts                 # Listar agentes Chatwoot
├── useMessagingRealtime.ts      # Supabase Realtime dedicado
└── useAudioRecorder.ts          # Web Audio API
```

### 2.4 Novos Componentes

```
features/messaging/components/chat/
├── ChatLayout.tsx               # Layout 3 colunas
├── ConversationList.tsx         # Sidebar esquerda
├── ConversationListItem.tsx     # Item na lista
├── ConversationFilters.tsx      # Filtros
├── ChatView.tsx                 # Área central
├── MessageBubble.tsx            # Bolha de mensagem
├── MessageInput.tsx             # Input com mídia
├── AudioRecorder.tsx            # Gravador
├── ImageUpload.tsx              # Upload imagem
├── PrivateNoteInput.tsx         # Nota interna
├── ContactInfoPanel.tsx         # Sidebar direita
├── AssignmentDropdown.tsx       # Dropdown agente
└── ConversationHeader.tsx       # Header
```

### 2.5 Expandir Chatwoot Client

**Métodos que já existem em `lib/chatwoot/client.ts`:**

| Método | Status | Notas |
|--------|--------|-------|
| `getConversations(filters)` | ✅ Existe | Aceita status, assignee, inbox |
| `toggleConversationStatus()` | ✅ Existe | open/resolved/pending |
| `assignConversation()` | ✅ Existe | Aceita agentId |
| `sendTextMessage(id, content, isPrivate)` | ✅ Existe | `isPrivate=true` para notas |

**Métodos a adicionar:**

| Método | Propósito | Detalhes |
|--------|-----------|----------|
| `sendMessageWithAttachments()` | Enviar mídia | multipart/form-data |
| `getAgents()` | Listar agentes | GET /api/v1/accounts/:id/agents |
| `unassignConversation()` | Remover atribuição | Wrapper: `assignConversation(id, 0)` |

### 2.6 Configuração Chatwoot

Adicionar webhook adicional no Chatwoot apontando para o CRM:

```
URL:    https://coronelpicanhacrm.vercel.app/api/messaging/webhook
Events: message_created, conversation_status_changed, conversation_updated
Secret: <CHATWOOT_WEBHOOK_SECRET>
```

> Este webhook é ADICIONAL ao do n8n. Ambos recebem os eventos.

### 2.7 Estratégia de Cache (Backfill + TTL)

**Problema:** O cache de mensagens (`messaging_messages_cache`) só recebe mensagens via webhook. Quando o usuário abre uma conversa pela primeira vez, o cache pode estar vazio.

**Solução: Backfill on-demand**

```typescript
// GET /api/messaging/conversations/[id]/messages
async function GET(request, { params }) {
    const { conversationId } = params;

    // 1. Verificar cache local
    const cached = await supabase
        .from('messaging_messages_cache')
        .select('*')
        .eq('chatwoot_conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(50);

    // 2. Se cache vazio ou stale, buscar do Chatwoot
    if (!cached.data?.length) {
        const chatwoot = await getChatwootClient(organizationId);
        const messages = await chatwoot.getMessages(conversationId, { limit: 50 });

        // 3. Popular cache
        await supabase.from('messaging_messages_cache').upsert(
            messages.map(m => ({
                organization_id: organizationId,
                chatwoot_message_id: m.id,
                chatwoot_conversation_id: conversationId,
                content: m.content,
                message_type: m.message_type,
                sender_name: m.sender?.name,
                created_at: m.created_at,
            })),
            { onConflict: 'organization_id,chatwoot_message_id' }
        );

        return NextResponse.json({ data: messages, source: 'chatwoot' });
    }

    return NextResponse.json({ data: cached.data, source: 'cache' });
}
```

**TTL / Cleanup automático:**

Agendar job no n8n ou cron para limpar mensagens antigas (> 90 dias):

```sql
-- Executar semanalmente via n8n Schedule Trigger
DELETE FROM public.messaging_messages_cache
WHERE created_at < NOW() - INTERVAL '90 days';
```

### 2.8 Reset unread_count

Quando o atendente abre uma conversa, resetar o contador de não-lidas:

```typescript
// POST /api/messaging/conversations/[id]/read
async function POST(request, { params }) {
    const { conversationId } = params;

    await supabase
        .from('messaging_conversation_links')
        .update({ unread_count: 0, updated_at: new Date().toISOString() })
        .eq('chatwoot_conversation_id', conversationId)
        .eq('organization_id', organizationId);

    return NextResponse.json({ success: true });
}
```

**No frontend (ChatView):**

```typescript
// Chamar quando a conversa é selecionada
useEffect(() => {
    if (selectedConversationId) {
        fetch(`/api/messaging/conversations/${selectedConversationId}/read`, {
            method: 'POST',
        });
    }
}, [selectedConversationId]);
```

---

## Prioridades de Implementação

### P0 - Crítico (Sprint 1)

| Funcionalidade | Descrição |
|----------------|-----------|
| **Enviar mensagens** | Input de texto + envio |
| **Receber em tempo real** | Webhook → cache → realtime |
| **Lista de conversas** | Sidebar com conversas abertas |
| **Visualizar histórico** | Carregar mensagens anteriores |

### P1 - Importante (Sprint 2)

| Funcionalidade | Descrição |
|----------------|-----------|
| **Upload de imagens** | Enviar fotos |
| **Enviar/receber áudio** | Gravador + player |
| **Notas internas** | Mensagens privadas |
| **Assignment** | Atribuir a agente |
| **Filtros** | Por status/agente |

### P2 - Desejável (Sprint 3)

| Funcionalidade | Descrição |
|----------------|-----------|
| **Typing indicator** | Indicador de digitação |
| **Read receipts** | Confirmação de leitura |
| **Templates** | Mensagens prontas |
| **Busca** | Buscar nas conversas |

---

## Impacto no Upstream (Fork-Safety)

### Arquivos que SÓ ADICIONAM (zero conflito)

| Diretório | Arquivos Novos |
|-----------|---------------|
| `features/messaging/components/chat/` | 12 componentes |
| `features/messaging/hooks/` | 5 hooks |
| `app/api/messaging/conversations/[id]/` | 4 routes |
| `supabase/migrations/` | 1 migration |

### Arquivos que TOCAM no upstream (mínimo)

| Arquivo | Mudança | Risco |
|---------|---------|-------|
| `lib/query/queryKeys.ts` | +4 keys em `messaging` | ✅ Merge-safe |
| `lib/chatwoot/client.ts` | +3 métodos (attach, agents, unassign) | ✅ Aditivo |

### Arquivos que NÃO tocamos

| Arquivo | Alternativa |
|---------|------------|
| `lib/realtime/useRealtimeSync.ts` | Hook dedicado `useMessagingRealtime` |
| `lib/realtime/presets.ts` | Não precisa |

---

## Checklist de Implementação

### Fase 2.1: Database
- [ ] Criar migration `20260215000000_messaging_chat_v2.sql`
- [ ] Tabela `messaging_messages_cache` com RLS + indexes + trigger
- [ ] Tabela `messaging_agents` com RLS + index + trigger
- [ ] Campos extras em `messaging_conversation_links`
- [ ] Function `increment_unread()`
- [ ] Habilitar Realtime para ambas tabelas novas
- [ ] Aplicar migration

### Fase 2.2: Chatwoot Client
- [ ] `sendMessageWithAttachments()` (multipart/form-data)
- [ ] `getAgents()`
- [ ] `unassignConversation()` (wrapper)

> **Nota:** `assignConversation`, `toggleConversationStatus`, `sendTextMessage` já existem.

### Fase 2.3: API Routes
- [ ] `GET /api/messaging/conversations` (listar)
- [ ] `GET/POST /api/messaging/conversations/[id]/messages` (histórico + enviar)
- [ ] `POST /api/messaging/conversations/[id]/assign`
- [ ] `POST /api/messaging/conversations/[id]/status`
- [ ] `POST /api/messaging/conversations/[id]/notes`
- [ ] `POST /api/messaging/conversations/[id]/read` (reset unread)
- [ ] `POST /api/messaging/messages/upload`
- [ ] `GET /api/messaging/agents`
- [ ] `POST /api/messaging/webhook` com HMAC validation

### Fase 2.4: Hooks
- [ ] `useConversations` (listar conversas da org)
- [ ] `useMessages` (histórico de uma conversa)
- [ ] `useSendMessage` (mutation de envio)
- [ ] `useAssignConversation` (mutation de assignment)
- [ ] `useToggleStatus` (mutation open/resolve)
- [ ] `useAgents` (listar agentes)
- [ ] `useMessagingRealtime` (Supabase Realtime dedicado)
- [ ] `useMarkAsRead` (reset unread_count)
- [ ] `useAudioRecorder` (Web Audio API)

### Fase 2.5: Componentes
- [ ] `ChatLayout`
- [ ] `ConversationList`
- [ ] `ConversationListItem`
- [ ] `ConversationFilters`
- [ ] `ChatView`
- [ ] `MessageBubble`
- [ ] `MessageInput`
- [ ] `AudioRecorder`
- [ ] `ImageUpload`
- [ ] `PrivateNoteInput`
- [ ] `ContactInfoPanel`
- [ ] `AssignmentDropdown`
- [ ] `ConversationHeader`

### Fase 2.6: Integração
- [ ] Configurar webhook adicional no Chatwoot (apontar para `/api/messaging/webhook`)
- [ ] Implementar HMAC validation no webhook
- [ ] Testar fluxo completo envio (CRM → Chatwoot → WhatsApp)
- [ ] Testar fluxo completo recebimento (WhatsApp → Chatwoot → CRM cache → Realtime)
- [ ] Testar backfill quando cache está vazio
- [ ] Configurar TTL cleanup job no n8n

### Fase 2.7: Documentação
- [ ] Atualizar `ARCHITECTURE.md`
- [ ] Criar `REALTIME_SYNC.md`
- [ ] Atualizar README do messaging
- [ ] Documentar convenção de rotas `/api/chatwoot/` vs `/api/messaging/`

---

## Referências

- [Chatwoot API Docs](https://www.chatwoot.com/developers/api/)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- Migration existente: `20260213100000_chatwoot_messaging.sql`
