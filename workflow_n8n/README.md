# Integração N8N + LagostaCRM - Agente SDR WhatsApp

Workflow para atendimento via WhatsApp integrado ao LagostaCRM.

## Arquitetura

```
WhatsApp → Chatwoot → Webhook N8N → Agente IA → API LagostaCRM
                                                      ↓
                                               Kanban (Deals)
```

**IMPORTANTE:** O workflow usa a **API HTTP do LagostaCRM**, não acesso direto ao Supabase. Isso garante:
- Validação de dados
- Disparo de webhooks/eventos
- Auditoria
- Segurança

---

## Board Configurado

**Nome:** Gestão de Clientes - Agência Multisserviços
**Key:** `gestao-de-clientes-agencia-multisservicos`

### Etapas do Kanban

| Ordem | Etapa | Cor | Ação no Workflow |
|-------|-------|-----|------------------|
| 0 | Contato Inicial | 🔵 Azul | Criação automática do deal |
| 1 | Qualificação & Reunião | 🟢 Verde | `crm_qualificacao` |
| 2 | Proposta / Agendamento | 🟡 Amarelo | `crm_proposta` |
| 3 | Negociação & Fechamento | 🟠 Laranja | `crm_negociacao` |
| 4 | Cliente Ativo / Planejamento | 🔴 Vermelho | `crm_cliente_ativo` (won) |
| 5 | Execução do Serviço | 🟣 Roxo | Manual |
| 6 | Entrega & Pós-Venda | 🩷 Rosa | Manual |

---

## Configuração no N8N

### 1. Credencial LagostaCRM API Key

1. No LagostaCRM: **Settings → Integrações → Gerar Nova Chave**
2. No N8N: **Credentials → Add Credential → Header Auth**
   - **Name:** `LagostaCRM API Key`
   - **Header Name:** `X-Api-Key`
   - **Header Value:** `ncrm_sua_chave_aqui`

### 2. Credencial Chatwoot API

1. No Chatwoot: **Settings → Account Settings → Access Token**
2. No N8N: **Credentials → Add Credential → Header Auth**
   - **Name:** `Chatwoot API`
   - **Header Name:** `api_access_token`
   - **Header Value:** `seu_token_chatwoot`

### 3. Variáveis do Fluxo

Edite o nó `Fluxo_Variaveis`:

| Variável | Valor |
|----------|-------|
| `CRM-Host` | `https://seu-lagostacrm.vercel.app` |
| `CRM-BoardKey` | `gestao-de-clientes-agencia-multisservicos` |
| `CW-Host` | `https://chatwoot.seudominio.com.br` |

### 4. Webhook Chatwoot

Configure no Chatwoot:
- **URL:** `https://seu-n8n.com/webhook/sdr-agencia-multisservicos`
- **Events:** `message_created`

---

## Tools do Agente IA

### Movimentação no Kanban

| Tool | Endpoint | Etapa Destino |
|------|----------|---------------|
| `crm_qualificacao` | `POST /deals/move-stage-by-identity` | Qualificação & Reunião |
| `crm_proposta` | `POST /deals/move-stage-by-identity` | Proposta / Agendamento |
| `crm_negociacao` | `POST /deals/move-stage-by-identity` | Negociação & Fechamento |
| `crm_cliente_ativo` | `POST /deals/move-stage-by-identity` | Cliente Ativo (+ won) |
| `crm_perdido` | `POST /deals/move-stage-by-identity` | Marca como lost |

### Gerenciamento

| Tool | Endpoint | Função |
|------|----------|--------|
| `update_contato` | `PATCH /contacts/{id}` | Atualiza nome/email |
| `buscar_deals` | `GET /deals` | Lista deals do contato |
| `redirect_human` | Chatwoot API | Transfere para humano |

---

## Fluxo de Atendimento

```
1. Cliente envia mensagem no WhatsApp
              ↓
2. Chatwoot recebe e dispara webhook
              ↓
3. N8N verifica se cliente existe no CRM
   ├── NÃO → Cria contato + deal (etapa "Contato Inicial")
   └── SIM → Busca dados do contato
              ↓
4. Agente IA processa mensagem
              ↓
5. IA usa tools para mover deal conforme conversa:
   • Entendeu necessidade → crm_qualificacao
   • Agendou reunião → crm_proposta
   • Enviou proposta → crm_negociacao
   • Fechou negócio → crm_cliente_ativo
   • Não tem interesse → crm_perdido
              ↓
6. Resposta enviada de volta ao WhatsApp
```

---

## Serviços da Agência (configurados no prompt)

- **Fotografia:** Eventos, produtos, corporativo
- **Vídeo:** Institucional, redes sociais, eventos
- **Gestão de Redes Sociais:** Conteúdo, engajamento, ads
- **Automação com IA:** Chatbots, atendimento automatizado

---

## Exemplos de Uso da API

### Mover deal para "Qualificação & Reunião"
```bash
curl -X POST "https://seu-crm/api/public/v1/deals/move-stage-by-identity" \
  -H "X-Api-Key: ncrm_sua_chave" \
  -H "Content-Type: application/json" \
  -d '{
    "board_key_or_id": "gestao-de-clientes-agencia-multisservicos",
    "phone": "+5511999999999",
    "to_stage_label": "Qualificação & Reunião"
  }'
```

### Marcar como Cliente (ganho)
```bash
curl -X POST "https://seu-crm/api/public/v1/deals/move-stage-by-identity" \
  -H "X-Api-Key: ncrm_sua_chave" \
  -H "Content-Type: application/json" \
  -d '{
    "board_key_or_id": "gestao-de-clientes-agencia-multisservicos",
    "phone": "+5511999999999",
    "to_stage_label": "Cliente Ativo / Planejamento",
    "mark": "won"
  }'
```

---

## Por que usar API HTTP e não Supabase direto?

| API HTTP ✅ | Supabase Direto ❌ |
|-------------|-------------------|
| Valida dados | Contorna validações |
| Dispara webhooks | Não dispara eventos |
| Normaliza telefones | Pode criar inconsistências |
| Auditoria completa | Sem rastreamento |
| API Key segura | Credenciais de banco |

---

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `agente_sdr_lagostacrm.json` | Workflow para importar no N8N |
| `README.md` | Esta documentação |
| `exemplos_payloads.md` | Exemplos de requisições API |

---

## Importando no N8N

1. **Workflows → Import from File**
2. Selecione `agente_sdr_lagostacrm.json`
3. Configure as credenciais (todos marcados `CONFIGURE_AQUI`)
4. Edite `Fluxo_Variaveis` com suas URLs
5. Ative o workflow
