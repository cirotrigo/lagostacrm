# Staging Smoke v2.0 — Instagram DM + WhatsApp

> **Data:** 2026-02-15  
> **Objetivo:** validar comportamento mínimo obrigatório antes de liberar Sprint 2 e piloto em produção controlada.
> **Guia leigo:** `.context/plans/instagram-dm-smoke-guia-leigo-v2.md`

---

## 1. Pré-requisitos

- Deploy de staging atualizado com migrations e código v2.0.
- Config ativa no `messaging_channel_configs` para WhatsApp e Instagram da organização piloto.
- Webhook do Chatwoot apontando para `/api/chatwoot/webhook`.
- Credenciais de smoke definidas em variáveis de ambiente locais.

Variáveis obrigatórias para o script:
- `SMOKE_BASE_URL`
- `SMOKE_CHATWOOT_ACCOUNT_ID`
- `SMOKE_CHATWOOT_INBOX_INSTAGRAM_ID`
- `SMOKE_CHATWOOT_INBOX_WHATSAPP_ID`
- `SMOKE_INSTAGRAM_IGSID`
- `SMOKE_WHATSAPP_PHONE`

Variáveis opcionais:
- `SMOKE_CHATWOOT_WEBHOOK_SECRET`
- `SMOKE_ORGANIZATION_ID`
- `SMOKE_TIMEOUT_MS`

---

## 2. Execução automatizada

Comando principal:

```bash
set -a
source .env.smoke.local
set +a
```

Depois execute:

```bash
npm run smoke:integrations
```

Comando direto do webhook smoke:

```bash
node scripts/smoke-chatwoot-webhook.mjs
```

Critério de aprovação automática:
- Todos os cenários do script em `PASS`.
- Exit code `0`.

---

## 3. Cenários obrigatórios (matriz)

1. **Regressão WhatsApp em cliente ativo**
- Entrada: evento `conversation_created` com `Channel::Whatsapp`.
- Esperado: webhook `200`, vínculo em `messaging_conversation_links`, resolução de contato sem quebra.

2. **Primeiro DM Instagram sem histórico**
- Entrada: evento `conversation_created` com `Channel::Instagram` e `identifier` (IGSID).
- Esperado: webhook `200`, contato resolvido/criado, vínculo criado.

3. **Reentrada Instagram (idempotência)**
- Entrada: mesmo `chatwoot_conversation_id` reenviado.
- Esperado: operação idempotente via upsert (`organization_id,chatwoot_conversation_id`), sem duplicidade de vínculo.

4. **Cliente com múltiplos canais (isolamento)**
- Entrada: eventos para inbox WhatsApp e Instagram da mesma org.
- Esperado: roteamento correto por canal/inbox, sem mistura de identidade.

5. **Falha provider/webhook e recuperação (manual)**
- Simular indisponibilidade temporária (ex.: bloquear endpoint ou secret inválido).
- Esperado: falha detectada por monitoramento + recuperação após restauração + replay validado.

---

## 4. Verificações pós-execução (SQL)

Executar em staging (ajustar `organization_id`):

```sql
-- 1) Conversas de smoke recebidas
select organization_id, chatwoot_conversation_id, contact_id, status, updated_at
from messaging_conversation_links
where organization_id = '<ORG_ID>'
order by updated_at desc
limit 20;

-- 2) Identidades criadas/associadas
select organization_id, source, external_id, contact_id, updated_at
from messaging_contact_identities
where organization_id = '<ORG_ID>'
order by updated_at desc
limit 20;

-- 3) Auditoria de resolução
select organization_id, source, external_id, action, contact_id, identity_id, created_at
from messaging_identity_resolution_log
where organization_id = '<ORG_ID>'
order by created_at desc
limit 30;
```

---

## 5. Critério de Go/No-Go para Sprint 2

`GO` se:
- Script de smoke passou 100%.
- Sem erro crítico no monitoramento por ao menos 30 min após execução.
- Verificação SQL consistente para links e identidades.

`NO-GO` se:
- Qualquer cenário obrigatório falhar.
- Duplicidade de vínculo/identidade sem explicação.
- Regressão WhatsApp detectada.

---

## 6. Evidências mínimas a anexar

- Log completo do comando `npm run smoke:integrations`.
- Captura de configuração ativa por inbox/canal da organização piloto.
- Resultado das 3 consultas SQL de verificação.
- Decisão final Go/No-Go com data/hora e responsável.
