# Auditoria de Mensageria - LagostaCRM

> **Data:** 2026-02-13
> **Versão:** 1.0
> **Autor:** Claude Code

---

## 1. Estado Atual do Schema

### Tabelas Existentes (Relevantes para Messaging)

| Tabela | Descrição | Migration |
|--------|-----------|-----------|
| `organizations` | Multi-tenancy | `20251201000000_schema_init.sql` |
| `profiles` | Usuários + org_id + role | `20251201000000_schema_init.sql` |
| `contacts` | Contatos CRM (campo `phone` para matching) | `20251201000000_schema_init.sql` |
| `deals` | Oportunidades (campo `tags TEXT[]`) | `20251201000000_schema_init.sql` |
| `board_stages` | Stages do Kanban (campos `label` e `name`) | `20251201000000_schema_init.sql` |
| `tags` | Sistema de tags | `20251201000000_schema_init.sql` |
| `integration_outbound_endpoints` | Webhooks (campos `events[]`, `active`) | `20251201000000_schema_init.sql` |
| `whatsapp_sessions` | Sessões WPPConnect | `20260210000000_whatsapp_messaging.sql` |
| `whatsapp_conversations` | Conversas WhatsApp | `20260210000000_whatsapp_messaging.sql` |
| `whatsapp_messages` | Mensagens WhatsApp | `20260210000000_whatsapp_messaging.sql` |
| `whatsapp_label_sync` | Labels WhatsApp ↔ CRM | `20260210000000_whatsapp_messaging.sql` |

### Função de Updated_at

```sql
-- Nome correto: update_updated_at_column()
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Patterns de RLS

**Padrão A** — Todos autenticados:
```sql
CREATE POLICY "Enable all access for authenticated users"
    ON public.tabela FOR ALL TO authenticated
    USING (true) WITH CHECK (true);
```

**Padrão B** — Admin gerencia, membros lêem:
```sql
CREATE POLICY "Admins can manage X" ON public.tabela
    FOR ALL TO authenticated
    USING (auth.uid() IN (
        SELECT id FROM profiles WHERE organization_id = tabela.organization_id AND role = 'admin'
    ));

CREATE POLICY "Members can view X" ON public.tabela
    FOR SELECT TO authenticated
    USING (auth.uid() IN (
        SELECT id FROM profiles WHERE organization_id = tabela.organization_id
    ));
```

---

## 2. Patterns a Seguir

### Query Keys (`lib/query/queryKeys.ts`)

```typescript
export const queryKeys = {
    deals: createQueryKeys('deals'),
    contacts: createExtendedQueryKeys('contacts', base => ({...})),
    whatsapp: {
        all: ['whatsapp'] as const,
        conversations: () => ['whatsapp', 'conversations'] as const,
        // ...
    },
};
```

### Supabase Server Client (`lib/supabase/server.ts`)

- `createClient()` — Client com auth do usuário
- `createAdminClient()` — Client com service role (requer request context)
- `createStaticAdminClient()` — Client sem request context (para webhooks)

### Realtime Sync (`lib/realtime/`)

- Suporta tabelas: `whatsapp_sessions`, `whatsapp_conversations`, `whatsapp_messages`
- Uso: `useRealtimeSync('whatsapp_messages', { onchange: handler })`

---

## 3. Pontos de Integração Identificados

### 3.1 Trigger Existente para Labels

O trigger `trg_notify_deal_stage_changed` já existe e envia webhook `deal.stage_changed` quando um deal muda de stage. **Reutilizar** ao invés de criar novo trigger.

### 3.2 Matching de Contatos

Campo `contacts.phone` usa formato E.164 normalizado. Chatwoot deve enviar telefone no mesmo formato para matching.

### 3.3 Tags de Deals

Campo `deals.tags TEXT[]` já existe. Auto-tagging via trigger `trg_auto_tag_deal_on_stage` (criado em `20260213000000_deal_stage_auto_tag.sql`).

---

## 4. WPPConnect Existente

### API Routes (`app/api/whatsapp/`)

| Rota | Descrição |
|------|-----------|
| `webhook/route.ts` | Recebe eventos do n8n |
| `session/route.ts` | Gerencia sessões |
| `conversations/route.ts` | CRUD de conversas |
| `send/route.ts` | Envia mensagens |

### Features (`features/messaging/`)

- `MessagingPage.tsx` — UI de chat WPPConnect
- `hooks/useMessagingController.ts` — Controller principal
- `components/` — ConversationList, MessageThread, etc.

---

## 5. Decisões de Implementação

### 5.1 Chatwoot vs WPPConnect

O Chatwoot será usado como **backend de mensageria** (substitui conexão direta WPPConnect), mas a integração de labels ainda usa WPPConnect API.

### 5.2 Estrutura de Arquivos Novos

```
lib/chatwoot/
├── client.ts         # API client (fetch direto, tipado)
├── types.ts          # Types do Chatwoot
├── config.ts         # Busca config da org
└── webhooks.ts       # Processamento de webhooks

app/api/chatwoot/
├── conversations/route.ts
├── messages/route.ts
├── webhook/route.ts
└── labels/route.ts
```

### 5.3 Novas Tabelas

| Tabela | Descrição | RLS |
|--------|-----------|-----|
| `messaging_channel_configs` | Credenciais Chatwoot por org | Padrão B |
| `messaging_conversation_links` | Link CRM ↔ Chatwoot | Padrão A |
| `messaging_label_map` | Mapeamento de tags | Padrão B |
| `messaging_label_sync_log` | Auditoria de sync | Padrão A |

---

## 6. Checklist de Conformidade

- [x] RLS patterns identificados (Padrão A e B)
- [x] Função `update_updated_at_column()` confirmada
- [x] Trigger `trg_notify_deal_stage_changed` disponível
- [x] Query keys pattern documentado
- [x] WPPConnect integration mapeada
- [x] Pontos de integração identificados

---

## 7. Próximos Passos

1. ✅ Criar migration `20260213100000_chatwoot_messaging.sql`
2. ✅ Criar `lib/chatwoot/` (client, types, config)
3. ✅ Criar `app/api/chatwoot/` (routes)
4. ✅ Atualizar `queryKeys.ts` com keys para Chatwoot
5. ✅ Criar hooks e componentes em `features/messaging/`
6. ✅ Documentar em `.context/integrations/chatwoot/`
