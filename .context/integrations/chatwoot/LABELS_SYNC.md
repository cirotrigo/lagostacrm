# Sistema de Sincronizacao de Labels

> **Versao:** 1.0
> **Data:** 2026-02-13

---

## Visao Geral

O sistema de labels sincroniza automaticamente tags entre o CRM, Chatwoot e WhatsApp quando deals mudam de stage no Kanban.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      FLUXO DE LABELS SYNC                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. Deal muda de stage no CRM (drag & drop no Kanban)                   │
│                    ↓                                                     │
│  2. Trigger trg_auto_tag_deal_on_stage (BEFORE UPDATE)                  │
│     - Busca mapeamento em messaging_label_map                           │
│     - Adiciona tag ao deals.tags[]                                      │
│                    ↓                                                     │
│  3. Trigger trg_notify_deal_stage_changed (AFTER UPDATE)                │
│     - Envia webhook deal.stage_changed                                  │
│                    ↓                                                     │
│  4. n8n recebe webhook deal.stage_changed                               │
│     - Consulta messaging_label_map via API                              │
│     - Aplica label no Chatwoot (API)                                    │
│     - Aplica label no WhatsApp (WPPConnect)                             │
│     - Registra em messaging_label_sync_log                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Tabelas

### messaging_label_map

Mapeamento entre tags do CRM, labels do Chatwoot e labels do WhatsApp.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | UUID | PK |
| `organization_id` | UUID | FK para organizations |
| `crm_tag_name` | TEXT | Nome da tag no CRM (ex: "em-atendimento") |
| `chatwoot_label` | TEXT | Label no Chatwoot (ex: "em_atendimento") |
| `whatsapp_label` | TEXT | Label no WhatsApp (pode ser diferente) |
| `board_stage_id` | UUID | FK para board_stages (opcional) |
| `color` | TEXT | Cor para consistencia visual |
| `sync_to_chatwoot` | BOOLEAN | Se deve sincronizar para Chatwoot |
| `sync_to_whatsapp` | BOOLEAN | Se deve sincronizar para WhatsApp |

### messaging_label_sync_log

Auditoria de todas as sincronizacoes de labels.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | UUID | PK |
| `organization_id` | UUID | FK |
| `deal_id` | UUID | Deal que acionou o sync |
| `action` | TEXT | 'add_label', 'remove_label', 'sync_error' |
| `label_name` | TEXT | Nome da label aplicada |
| `target` | TEXT | 'chatwoot', 'whatsapp', 'crm' |
| `success` | BOOLEAN | Se a operacao foi bem sucedida |
| `error_message` | TEXT | Mensagem de erro (se houver) |
| `triggered_by` | TEXT | Origem: 'stage_change', 'manual', 'webhook' |

---

## Configuracao de Mapeamentos

### Via API

```bash
# Criar mapeamento
POST /api/chatwoot/labels
Content-Type: application/json
Authorization: Bearer <token>

{
  "crm_tag_name": "em-atendimento",
  "chatwoot_label": "em_atendimento",
  "whatsapp_label": "Em Atendimento",
  "board_stage_id": "uuid-do-stage",
  "color": "#10B981",
  "sync_to_chatwoot": true,
  "sync_to_whatsapp": true,
  "create_in_chatwoot": true
}
```

### Exemplo de Mapeamentos

| Stage | CRM Tag | Chatwoot | WhatsApp |
|-------|---------|----------|----------|
| Nova Interacao | `nova-interacao` | `nova_interacao` | Nova Interacao |
| Em Atendimento | `em-atendimento` | `em_atendimento` | Em Atendimento |
| Aguardando Cliente | `aguardando-cliente` | `aguardando_cliente` | Aguardando Cliente |
| Finalizado | `finalizado` | `finalizado` | Finalizado |

---

## Trigger de Auto-Tag

O trigger `trg_auto_tag_deal_on_stage` adiciona automaticamente a tag ao deal quando ele muda de stage:

```sql
CREATE TRIGGER trg_auto_tag_deal_on_stage
    BEFORE UPDATE ON public.deals
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_auto_tag_deal_on_stage_change();
```

A funcao busca o mapeamento e adiciona a tag ao array `deals.tags[]`:

```sql
-- Se existe mapeamento para o stage
IF v_label_map.id IS NOT NULL THEN
    -- Adicionar tag se nao existe
    IF NOT (NEW.tags @> ARRAY[v_label_map.crm_tag_name]) THEN
        NEW.tags := array_append(COALESCE(NEW.tags, ARRAY[]::TEXT[]), v_label_map.crm_tag_name);
    END IF;
END IF;
```

---

## Workflow n8n

O workflow n8n que processa `deal.stage_changed`:

1. **Trigger**: Webhook recebe evento
2. **HTTP Request**: GET `/api/chatwoot/labels?stage_id=xxx`
3. **HTTP Request**: GET `/api/chatwoot/conversation-links?deal_id=xxx`
4. **HTTP Request**: POST Chatwoot API para aplicar label
5. **HTTP Request**: POST WPPConnect API para aplicar label
6. **HTTP Request**: POST `/api/chatwoot/labels/sync-log`

### Payload do Webhook

```json
{
  "event": "deal.stage_changed",
  "deal": {
    "id": "uuid",
    "title": "Reserva Mesa 10",
    "stage_id": "uuid-novo-stage",
    "tags": ["em-atendimento"],
    "contact_id": "uuid"
  },
  "previous_stage_id": "uuid-antigo",
  "organization_id": "uuid"
}
```

---

## API Endpoints

### Listar Mapeamentos

```bash
GET /api/chatwoot/labels
GET /api/chatwoot/labels?stage_id=uuid
```

### Criar Mapeamento (Admin)

```bash
POST /api/chatwoot/labels
```

### Registrar Log de Sync (n8n)

```bash
POST /api/chatwoot/labels/sync-log
X-Organization-Id: uuid
Authorization: Bearer <N8N_WEBHOOK_SECRET>

{
  "deal_id": "uuid",
  "action": "add_label",
  "label_name": "em_atendimento",
  "target": "chatwoot",
  "success": true,
  "triggered_by": "stage_change"
}
```

### Consultar Log

```bash
GET /api/chatwoot/labels/sync-log
GET /api/chatwoot/labels/sync-log?deal_id=uuid
```

---

## Troubleshooting

### Label nao aparece no Chatwoot

1. Verificar se o mapeamento existe em `messaging_label_map`
2. Verificar se `sync_to_chatwoot = true`
3. Verificar logs em `messaging_label_sync_log`
4. Verificar se a label existe no Chatwoot (pode precisar criar primeiro)

### Sync falhou

1. Consultar `messaging_label_sync_log` para ver erro
2. Verificar credenciais em `messaging_channel_configs`
3. Verificar conectividade com Chatwoot/WPPConnect

### Tag nao foi adicionada ao deal

1. Verificar se `board_stage_id` esta correto no mapeamento
2. Verificar se o trigger `trg_auto_tag_deal_on_stage` esta ativo
3. Rodar query manual para testar:

```sql
SELECT * FROM messaging_label_map
WHERE board_stage_id = 'uuid-do-stage';
```

---

## Referencias

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)
- [Chatwoot Labels API](https://www.chatwoot.com/developers/api/#tag/Conversations/operation/add-conversation-labels)
