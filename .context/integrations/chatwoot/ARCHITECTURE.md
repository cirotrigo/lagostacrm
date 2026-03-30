# Arquitetura da Integracao Chatwoot

> **Versao:** 1.0
> **Data:** 2026-02-13
> **Status:** Implementado

---

## Visao Geral

O LagostaCRM integra com o Chatwoot como backend de mensageria omnichannel. O Chatwoot gerencia as conversas WhatsApp (via Evolution API) e o CRM sincroniza dados relevantes.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          ARQUITETURA ATUAL                               │
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
│                                                    [app/api/chatwoot/]   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Componentes

### 1. Biblioteca Chatwoot (`lib/chatwoot/`)

| Arquivo | Descricao |
|---------|-----------|
| `client.ts` | Cliente API tipado (fetch direto) |
| `types.ts` | Tipos TypeScript para Chatwoot API |
| `config.ts` | Carrega credenciais do banco de dados |
| `webhooks.ts` | Processamento de webhooks |
| `index.ts` | Exports publicos |

### 2. API Routes (`app/api/chatwoot/`)

| Rota | Metodos | Descricao |
|------|---------|-----------|
| `/conversations` | GET | Lista conversas |
| `/conversations/[id]` | GET, PATCH | Conversa especifica |
| `/conversations/[id]/messages` | GET, POST | Mensagens |
| `/webhook` | GET, POST | Webhooks do Chatwoot |
| `/labels` | GET, POST | Mapeamentos de labels |
| `/labels/sync-log` | GET, POST | Log de sincronizacao |
| `/conversation-links` | GET, POST, PATCH | Vinculos CRM |

### 3. Feature Components (`features/messaging/chatwoot/`)

| Componente | Descricao |
|------------|-----------|
| `ConversationTimeline` | Timeline read-only para deals/contacts |
| Hooks | `useChatwootConversations`, `useConversationLinks`, etc. |

### 4. Banco de Dados (`supabase/migrations/`)

| Tabela | Descricao |
|--------|-----------|
| `messaging_channel_configs` | Credenciais Chatwoot por org |
| `messaging_conversation_links` | Vinculo CRM ↔ Chatwoot |
| `messaging_label_map` | Mapeamento de tags |
| `messaging_label_sync_log` | Auditoria de sync |

---

## Fluxos de Dados

### 1. Webhook Chatwoot → CRM

```
Chatwoot envia webhook
        ↓
POST /api/chatwoot/webhook
        ↓
Valida signature/secret
        ↓
Identifica organizacao (por account_id)
        ↓
Processa evento:
  - conversation_created → Cria messaging_conversation_links
  - message_created → Atualiza last_message_preview/at
  - conversation_status_changed → Atualiza status
        ↓
Supabase Realtime notifica clients
```

### 2. CRM → Chatwoot API

```
Usuario acessa deal/contact
        ↓
ConversationTimeline monta
        ↓
useConversationLinks() busca links
        ↓
GET /api/chatwoot/conversation-links
        ↓
Retorna conversas vinculadas
        ↓
Usuario clica "Abrir no Chatwoot"
        ↓
Redireciona para chatwoot_url
```

### 3. Labels Sync (via n8n)

```
Deal muda de stage (Kanban drag)
        ↓
Trigger trg_auto_tag_deal_on_stage
        ↓
Adiciona tag ao deals.tags[]
        ↓
Trigger trg_notify_deal_stage_changed
        ↓
Webhook deal.stage_changed → n8n
        ↓
n8n consulta messaging_label_map
        ↓
n8n aplica label no Chatwoot (API)
        ↓
n8n aplica label no WhatsApp (WPPConnect)
        ↓
n8n registra em messaging_label_sync_log
```

---

## Configuracao Multi-Tenant

Cada organizacao tem suas proprias credenciais Chatwoot armazenadas em `messaging_channel_configs`:

```sql
SELECT * FROM messaging_channel_configs
WHERE organization_id = 'uuid'
AND status = 'active';
```

O client e criado dinamicamente:

```typescript
const chatwoot = await createChatwootClientForOrg(supabase, organizationId);
```

---

## Seguranca

### RLS Policies

- `messaging_channel_configs`: Padrao B (admin gerencia, membros leem)
- `messaging_conversation_links`: Padrao A (todos autenticados)
- `messaging_label_map`: Padrao B (admin gerencia, membros leem)
- `messaging_label_sync_log`: Padrao A (todos autenticados)

### Webhooks

- Validacao via `CHATWOOT_WEBHOOK_SECRET`
- Identificacao de org via header `X-Organization-Id` ou `chatwoot_account_id`

---

## Query Keys

```typescript
queryKeys.chatwoot = {
    all: ['chatwoot'],
    conversations: (filters?) => ['chatwoot', 'conversations', filters],
    conversation: (id) => ['chatwoot', 'conversations', id],
    messages: (conversationId) => ['chatwoot', 'messages', conversationId],
    labels: () => ['chatwoot', 'labels'],
    labelMappings: () => ['chatwoot', 'labelMappings'],
    conversationLinks: (params?) => ['chatwoot', 'conversationLinks', params],
    syncLog: (dealId?) => ['chatwoot', 'syncLog', dealId],
};
```

---

## Variaveis de Ambiente

```env
# Chatwoot (fallback/dev)
CHATWOOT_BASE_URL=https://chatwoot.example.com
CHATWOOT_API_TOKEN=
CHATWOOT_ACCOUNT_ID=
CHATWOOT_WEBHOOK_SECRET=

# n8n (para labels sync)
N8N_WEBHOOK_SECRET=
```

---

## Referencias

- [Chatwoot API Docs](https://www.chatwoot.com/developers/api)
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)
- [LABELS_SYNC.md](./LABELS_SYNC.md)
