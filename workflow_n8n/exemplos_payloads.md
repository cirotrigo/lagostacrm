# Exemplos de Payloads - API LagostaCRM

## Contatos

### Criar/Atualizar Contato (Upsert)
```json
POST /api/public/v1/contacts

{
  "name": "João Silva",
  "email": "joao@empresa.com",
  "phone": "+5511999999999",
  "role": "Gerente",
  "company_name": "Empresa XYZ",
  "source": "WHATSAPP",
  "stage": "LEAD",
  "status": "ACTIVE",
  "notes": "Lead interessado em automação"
}
```

**Resposta (201 Created):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "João Silva",
    "email": "joao@empresa.com",
    "phone": "+5511999999999",
    "role": "Gerente",
    "company_name": "Empresa XYZ",
    "client_company_id": "auto-generated-uuid",
    "source": "WHATSAPP",
    "stage": "LEAD",
    "status": "ACTIVE",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  },
  "action": "created"
}
```

### Buscar Contato por Telefone
```
GET /api/public/v1/contacts?phone=+5511999999999
```

**Resposta:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "João Silva",
      "email": "joao@empresa.com",
      "phone": "+5511999999999",
      ...
    }
  ],
  "nextCursor": null
}
```

### Atualizar Contato
```json
PATCH /api/public/v1/contacts/550e8400-e29b-41d4-a716-446655440000

{
  "name": "João Silva Santos",
  "email": "joao.santos@novaempresa.com"
}
```

---

## Deals

### Criar Deal
```json
POST /api/public/v1/deals

{
  "title": "Lead WhatsApp - João Silva",
  "value": 5000,
  "board_key": "vendas-sdr",
  "contact_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Resposta (201 Created):**
```json
{
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "title": "Lead WhatsApp - João Silva",
    "value": 5000,
    "board_id": "board-uuid",
    "stage_id": "first-stage-uuid",
    "contact_id": "550e8400-e29b-41d4-a716-446655440000",
    "is_won": false,
    "is_lost": false,
    "created_at": "2024-01-15T10:35:00Z",
    "updated_at": "2024-01-15T10:35:00Z"
  },
  "action": "created"
}
```

### Criar Deal com Contato Inline (cria contato automaticamente)
```json
POST /api/public/v1/deals

{
  "title": "Novo Lead - Maria",
  "value": 3000,
  "board_key": "vendas-sdr",
  "contact": {
    "name": "Maria Oliveira",
    "phone": "+5511888888888",
    "email": "maria@email.com"
  }
}
```

### Listar Deals por Contato
```
GET /api/public/v1/deals?contact_id=550e8400-e29b-41d4-a716-446655440000&status=open
```

### Listar Deals por Board
```
GET /api/public/v1/deals?board_key=vendas-sdr&status=open
```

---

## Movimentação de Etapas (Kanban)

### Mover por ID do Deal
```json
POST /api/public/v1/deals/660e8400-e29b-41d4-a716-446655440001/move-stage

{
  "to_stage_label": "Qualificado"
}
```

### Mover por Telefone/Email (SEM precisar do UUID!)
```json
POST /api/public/v1/deals/move-stage-by-identity

{
  "board_key_or_id": "vendas-sdr",
  "phone": "+5511999999999",
  "to_stage_label": "Em Conexão"
}
```

### Mover e Marcar como Ganho
```json
POST /api/public/v1/deals/move-stage-by-identity

{
  "board_key_or_id": "vendas-sdr",
  "phone": "+5511999999999",
  "to_stage_label": "Ganho",
  "mark": "won"
}
```

### Mover e Marcar como Perdido
```json
POST /api/public/v1/deals/move-stage-by-identity

{
  "board_key_or_id": "vendas-sdr",
  "phone": "+5511999999999",
  "to_stage_label": "Desqualificado",
  "mark": "lost"
}
```

**Resposta:**
```json
{
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "title": "Lead WhatsApp - João Silva",
    "stage_id": "new-stage-uuid",
    "is_won": true,
    "closed_at": "2024-01-15T14:00:00Z",
    ...
  },
  "action": "moved"
}
```

---

## Boards e Stages

### Listar Boards
```
GET /api/public/v1/boards
```

**Resposta:**
```json
{
  "data": [
    {
      "id": "board-uuid",
      "key": "vendas-sdr",
      "name": "Vendas SDR",
      "description": "Pipeline de qualificação SDR",
      "position": 1,
      "is_default": true
    }
  ],
  "nextCursor": null
}
```

### Listar Stages de um Board
```
GET /api/public/v1/boards/vendas-sdr/stages
```

**Resposta:**
```json
{
  "data": [
    {
      "id": "stage-1-uuid",
      "label": "Novo Lead",
      "color": "#3B82F6",
      "order": 1
    },
    {
      "id": "stage-2-uuid",
      "label": "Em Conexão",
      "color": "#8B5CF6",
      "order": 2
    },
    {
      "id": "stage-3-uuid",
      "label": "Qualificado",
      "color": "#10B981",
      "order": 3
    },
    {
      "id": "stage-4-uuid",
      "label": "Agendado",
      "color": "#F59E0B",
      "order": 4
    },
    {
      "id": "stage-5-uuid",
      "label": "Ganho",
      "color": "#22C55E",
      "order": 5
    },
    {
      "id": "stage-6-uuid",
      "label": "Desqualificado",
      "color": "#EF4444",
      "order": 6
    }
  ]
}
```

---

## Atividades

### Criar Atividade
```json
POST /api/public/v1/activities

{
  "title": "Ligação de qualificação",
  "description": "Conversa inicial sobre necessidades",
  "type": "call",
  "date": "2024-01-15T15:00:00Z",
  "deal_id": "660e8400-e29b-41d4-a716-446655440001",
  "contact_id": "550e8400-e29b-41d4-a716-446655440000",
  "completed": false
}
```

### Tipos de Atividade
- `call` - Ligação
- `meeting` - Reunião
- `email` - E-mail
- `task` - Tarefa
- `note` - Nota

---

## Erros Comuns

### 401 - Unauthorized
```json
{
  "error": "Missing X-Api-Key",
  "code": "AUTH_MISSING"
}
```

### 404 - Not Found
```json
{
  "error": "Deal not found for this identity",
  "code": "NOT_FOUND"
}
```

### 409 - Conflict
```json
{
  "error": "More than one open deal found for this identity in this board",
  "code": "AMBIGUOUS_MATCH"
}
```

### 422 - Validation Error
```json
{
  "error": "Stage not found for this board",
  "code": "VALIDATION_ERROR"
}
```
