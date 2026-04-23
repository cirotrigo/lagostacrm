# Contact Identifiers — Playbook de Rollout por Cliente

Guia operacional para migrar um cliente CRM multi-canal para a arquitetura `contact_identifiers` (Fase 2). Este documento consolida tudo que foi aprendido durante o rollout do Empório Fonseca em 2026-04-22/23, incluindo armadilhas não óbvias.

> **Pré-requisitos globais (já feitos no repo main):**
> - Fase 1 deployada: migration `20260422120000_contact_identifiers.sql`, endpoints CRUD de identifiers, lookup por identifier no GET /contacts.
> - Endpoint `move-stage-by-identity` aceita `channel+identifier` + `contact_id`.
> - Todas as correções de bugs aplicadas (Zod empty-string, lookup AND, wiring de erro).

Se vai deployar em cliente novo (não ainda no main), garanta primeiro `git pull` + `vercel deploy` do CRM dele.

---

## Resumo do que muda no cliente

| Componente | Antes | Depois |
|---|---|---|
| Identidade do contato | `contacts.phone` sobrecarregado (WhatsApp = phone, Instagram = IGSID) | Tabela `contact_identifiers` com `(channel, identifier)` |
| Lookup no webhook | `GET /contacts?phone=X` | `GET /contacts?identifier=X&channel=Y&phone=X` (fallback) |
| Mover stage | `/deals/move-stage-by-identity` com `phone+email` | Com `contact_id + channel + identifier` |
| Celular Instagram | `update_contato` trocava `phone` pelo real (duplicava) | `adicionar_identifier_contato` adiciona `(whatsapp, +5527...)` |
| Notificação stage | Payload básico | Payload enriquecido (source, deal.title, whatsapp_phone, identifiers) |

---

## Etapa 0 — Descobrir credenciais do cliente

```bash
# Se o .vercel está linkado ao projeto do cliente:
vercel env pull --environment=production /tmp/cliente-prod.env
grep NEXT_PUBLIC_SUPABASE_URL /tmp/cliente-prod.env
# → https://<project-ref>.supabase.co

# API key pública do CRM (para curl de validação):
grep PUBLIC_API_KEY /tmp/cliente-prod.env  # ou obter no painel /settings/api-keys
```

Precisa de:
- `SUPABASE_PROJECT_REF` do cliente (ex: `bmaacpemxgoiimttyvar`)
- `ACCESS_TOKEN` pessoal do Supabase (mesmo para todos os clientes se forem do mesmo dono — `sbp_...`)
- `API_KEY` pública do CRM do cliente (`ncrm_...`)
- `CRM_HOST` (ex: `https://emporiofonseca.vercel.app`)
- `BOARD_KEY` (ex: `gestao-de-atendimento-emporio-forseca`)
- `WORKFLOW_ID_SOFIA` do n8n (ex: `TvNXUETbiNy2mE5k`)
- `WORKFLOW_ID_NOTIF` se houver notificação separada

**Ao final, deletar o `.env` temporário:** `rm /tmp/cliente-prod.env`

---

## Etapa 1 — Aplicar migration no Supabase do cliente

A migration `20260422120000_contact_identifiers.sql` cria a tabela + índices + RLS + backfill dos contatos existentes.

```bash
ACCESS_TOKEN="sbp_..."
PROJECT_REF="<project-ref-do-cliente>"

SQL=$(cat supabase/migrations/20260422120000_contact_identifiers.sql)
curl -s -X POST "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data-raw "$(jq -Rn --arg q "$SQL" '{query: $q}')"
# Retorno esperado: []
```

**Validar backfill:**
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"query": "SELECT channel, COUNT(*) FROM contact_identifiers GROUP BY channel ORDER BY COUNT(*) DESC;"}'
```

Espera-se counts proporcionais ao número de contatos existentes no cliente, divididos entre whatsapp/instagram/email.

---

## Etapa 2 — Confirmar que endpoints estão no ar

```bash
API_KEY="ncrm_..."
CRM_HOST="https://cliente.vercel.app"

# 1. Lookup por identifier (deve retornar contato se backfill rodou)
curl -s -H "X-Api-Key: $API_KEY" "$CRM_HOST/api/public/v1/contacts?identifier=<qualquer_phone_existente>&channel=whatsapp&limit=1" | jq .

# 2. Endpoint de identifiers
curl -s -H "X-Api-Key: $API_KEY" "$CRM_HOST/api/public/v1/contacts/<algum_id>/identifiers" | jq .

# 3. move-stage-by-identity com channel+identifier
curl -s -X POST -H "X-Api-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"board_key_or_id":"<BOARD_KEY>","channel":"whatsapp","identifier":"__probe__","to_stage_label":"Triagem"}' \
  "$CRM_HOST/api/public/v1/deals/move-stage-by-identity"
# Retorno esperado: {"error":"Deal not found for this identity","code":"NOT_FOUND"}
```

Se qualquer resposta vier com `"Invalid payload"` significa que o deploy do cliente não pegou as mudanças — fazer `vercel deploy` / `git pull` antes de continuar.

---

## Etapa 3 — Enriquecer trigger Supabase de notificação

Se o cliente usa `notify_stage_change` (ou equivalente) para disparar webhook para o n8n, a trigger precisa ser atualizada para incluir `contact_source`, `deal_title`, e o whatsapp identifier.

```sql
-- Rodar via Supabase Management API (adaptar webhook_url ao cliente)
CREATE OR REPLACE FUNCTION public.notify_stage_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  webhook_url TEXT := 'https://n8n-<HOST_DO_CLIENTE>/webhook/<SLUG>/stage-notification';
  stage_name TEXT;
  contact_name TEXT;
  contact_phone TEXT;
  contact_source TEXT;
  contact_identifiers JSONB;
  whatsapp_identifier TEXT;
BEGIN
  IF OLD.stage_id IS NOT DISTINCT FROM NEW.stage_id THEN
    RETURN NEW;
  END IF;

  SELECT label INTO stage_name FROM board_stages WHERE id = NEW.stage_id LIMIT 1;

  SELECT c.name, c.phone, c.source
    INTO contact_name, contact_phone, contact_source
  FROM contacts c WHERE c.id = NEW.contact_id LIMIT 1;

  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'channel', ci.channel,
      'identifier', ci.identifier,
      'is_primary', ci.is_primary
    ) ORDER BY ci.is_primary DESC, ci.created_at ASC),
    '[]'::jsonb
  ) INTO contact_identifiers
  FROM contact_identifiers ci
  WHERE ci.contact_id = NEW.contact_id AND ci.deleted_at IS NULL;

  SELECT ci.identifier INTO whatsapp_identifier
  FROM contact_identifiers ci
  WHERE ci.contact_id = NEW.contact_id
    AND ci.channel = 'whatsapp'
    AND ci.deleted_at IS NULL
  ORDER BY ci.is_primary DESC, ci.created_at ASC
  LIMIT 1;

  PERFORM net.http_post(
    url := webhook_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'stage_name', COALESCE(stage_name, 'Desconhecido'),
      'contact_name', COALESCE(contact_name, 'Cliente'),
      'contact_phone', COALESCE(contact_phone, ''),
      'contact_source', COALESCE(contact_source, ''),
      'contact_whatsapp_phone', COALESCE(whatsapp_identifier, ''),
      'contact_identifiers', contact_identifiers,
      'deal_id', NEW.id::text,
      'deal_title', COALESCE(NEW.title, ''),
      'deal_value', COALESCE(NEW.value, 0)::text,
      'ai_summary', COALESCE(NEW.ai_summary, '')
    )
  );

  RETURN NEW;
END;
$function$;
```

**Importante:** alguns clientes podem ter `notify_deal_stage_changed` em vez de `notify_stage_change` (ou ambas). Verificar qual está ativa na trigger:
```sql
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'deals';
```

---

## Etapa 4 — Mudanças no workflow n8n do agente

### 4.1 — Node `Encontrar_Cliente_CRM`

Atualizar os `queryParameters` para enviar `identifier+channel+phone` (ordem importa: identifier autoritativo, phone é fallback).

```json
"queryParameters": {
  "parameters": [
    {"name": "identifier", "value": "={{ $('Fluxo_Variaveis').item.json.ClienteTelefone }}"},
    {"name": "channel", "value": "={{ $('Fluxo_Variaveis').item.json.Canal.toLowerCase() }}"},
    {"name": "phone", "value": "={{ $('Fluxo_Variaveis').item.json.ClienteTelefone }}"},
    {"name": "limit", "value": "1"}
  ]
}
```

**Por que phone também?** Se o cliente nasceu antes do rollout e ainda não tem identifier cadastrado, o endpoint cai no fallback por phone. Sem isso, o webhook não acharia o contato e criaria duplicata.

**Por que `ClienteTelefone` em identifier?** O endpoint normaliza: se começar com `+`, é considerado telefone; caso contrário é identifier livre (IGSID). Para WhatsApp e Instagram funciona o mesmo valor.

### 4.2 — Novo node `Criar_Identifier_Novo` (lateral, side effect)

Adicionar node HTTP logo depois de `Set_Contato_Novo`, em paralelo ao fluxo que vai pro `Merge_Contatos`:

```json
{
  "name": "Criar_Identifier_Novo",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [<ajustar>],
  "parameters": {
    "method": "POST",
    "url": "={{ $('Fluxo_Variaveis').item.json['CRM-Host'] }}/api/public/v1/contacts/{{ $('Set_Contato_Novo').item.json.contact_id }}/identifiers",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"channel\": \"{{ $('Fluxo_Variaveis').item.json.Canal.toLowerCase() }}\",\n  \"identifier\": \"{{ $('Fluxo_Variaveis').item.json.ClienteTelefone }}\",\n  \"is_primary\": true\n}",
    "options": {"response": {"response": {"neverError": true}}}
  },
  "credentials": {"httpHeaderAuth": {"id": "<credentialId-do-cliente>", "name": "<nome-do-credential>"}}
}
```

**Wiring correto (ARMADILHA — ver nota):**
- `Set_Contato_Novo` → `Merge_Contatos` (input principal, main chain)
- `Set_Contato_Novo` → `Criar_Identifier_Novo` (branch lateral)
- `Criar_Identifier_Novo` **NÃO** conecta em nenhum nó downstream

> ⚠️ **Armadilha descoberta:** a primeira versão tinha `Set_Contato_Novo → Criar_Identifier_Novo → Merge_Contatos`. Quando o POST retornava 409 (identifier já pertence a outro contato), o JSON de erro virava input do Merge, corrompendo `contact_id` e quebrando todo o fluxo downstream. Sempre deixar o `Criar_Identifier_Novo` como side-effect isolado com `neverError: true`.

### 4.3 — Nova ferramenta `adicionar_identifier_contato`

Adicionar como `ai_tool` conectada ao `Agente de IA`:

```json
{
  "name": "adicionar_identifier_contato",
  "type": "n8n-nodes-base.httpRequestTool",
  "typeVersion": 4.2,
  "parameters": {
    "toolDescription": "Adiciona um identificador de canal (WhatsApp, Instagram, Messenger, Email, etc.) ao contato. Use quando o cliente do Instagram fornecer o celular real (channel='whatsapp', identifier='+5527...'), ou quando o cliente do WhatsApp mencionar Instagram. Idempotente: se o identificador já existir no mesmo contato, retorna 200. Se pertencer a OUTRO contato na mesma organização, retorna 409 (conflito).",
    "method": "POST",
    "url": "={{ $('Fluxo_Variaveis').item.json['CRM-Host'] }}/api/public/v1/contacts/{{ $('Merge_Contatos').item.json.contact_id }}/identifiers",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"channel\": \"{{ $fromAI('channel', 'Canal do identificador. Valores válidos: whatsapp, instagram, messenger, telegram, email, sms, other', 'string') }}\",\n  \"identifier\": \"{{ $fromAI('identifier', 'Valor do identificador. Para whatsapp: telefone em E.164 (+5527999999999). Para instagram: IGSID. Para email: endereço de email real.', 'string') }}\",\n  \"is_primary\": {{ $fromAI('is_primary', 'true se for o identificador principal deste canal para o contato', 'boolean') }}\n}",
    "options": {}
  }
}
```

Conexão: `adicionar_identifier_contato` → `Agente de IA` via `ai_tool`.

### 4.4 — Ferramenta `crm_mover_stage` — novo body

O body da HTTP tool precisa enviar os 4 modos de identidade (contact_id, channel+identifier, phone, email) para o endpoint pegar o mais robusto:

```json
"jsonBody": "={\n  \"board_key_or_id\": \"{{ $('Fluxo_Variaveis').item.json['CRM-BoardKey'] }}\",\n  \"contact_id\": \"{{ $('Merge_Contatos').item.json.contact_id }}\",\n  \"channel\": \"{{ $('Fluxo_Variaveis').item.json.Canal.toLowerCase() }}\",\n  \"identifier\": \"{{ $('Fluxo_Variaveis').item.json.ClienteTelefone }}\",\n  \"phone\": \"{{ $('Merge_Contatos').item.json.contact_phone }}\",\n  \"email\": \"{{ $('Merge_Contatos').item.json.contact_email }}\",\n  \"to_stage_label\": \"{{ $fromAI('stage', 'Nome exato da stage para mover o deal', 'string') }}\",\n  \"ai_summary\": \"{{ $fromAI('resumo', 'Resumo da situação do cliente e motivo da movimentação', 'string') }}\"\n}"
```

> ⚠️ **Armadilha descoberta:** n8n renderiza variáveis ausentes como `""`. Campos como `contact_id` (uuid) eram rejeitados pelo Zod. A correção está no endpoint (preprocess `emptyToUndefined`), já no main. Se deployou antes desse commit, vai falhar com `"Invalid payload"`.

### 4.5 — Descrição da tool `update_contato`

Atualizar para orientar o modelo a NÃO usar `phone` no Instagram:

```
"toolDescription": "Atualizar nome e email do contato no CRM. NÃO usar para celular no Instagram — use `adicionar_identifier_contato` em vez disso. Para WhatsApp o celular já vem correto do canal, não precisa atualizar."
```

### 4.6 — Prompt do agente (seção canal/celular)

Substituir a regra de canal/celular por:

```markdown
## REGRA #1B — CANAL E CELULAR
Você recebe o `canal` no bloco `<DadosUsuario>` (valores: `WHATSAPP` ou `INSTAGRAM`).

- **canal=WHATSAPP** → `client_phone` já é o celular real. Use direto no resumo do pedido, NÃO peça novamente.
- **canal=INSTAGRAM** → `client_phone` vem vazio. Pedir o celular naturalmente durante a conversa. Ao receber, chamar `adicionar_identifier_contato` com:
  - `channel="whatsapp"`
  - `identifier="<celular em E.164, ex: +5527999999999>"`
  - `is_primary=true`

  **NUNCA** chamar `update_contato` com o campo phone no Instagram — isso sobrescreve o identificador do canal e causa duplicação em sessões futuras.

OBRIGATÓRIO para pedidos de retirada e reservas. NÃO insistir mais de 1 vez. NUNCA inventar um número e NUNCA usar IDs internos (sequências longas de dígitos sem formato de telefone) como celular.
```

E na tabela de TOOLS adicionar a linha:
```
| `adicionar_identifier_contato` | Adicionar canal ao contato. Use quando cliente Instagram informar celular: `channel="whatsapp"`, `identifier="+5527..."`, `is_primary=true`. Também aceita `instagram`, `messenger`, `telegram`, `email`, `sms` |
```

E ajustar a Etapa 5 do fluxo de pedido para não ter mais o hack de ordenação:
```markdown
### Etapa 5 — Finalizar (ordem obrigatória)
1. Se canal=INSTAGRAM e o cliente informou o celular, chamar `adicionar_identifier_contato` com `channel="whatsapp"`, `identifier="<celular E.164>"`, `is_primary=true`
2. Chamar `crm_mover_stage` com `stage="<Stage de retirada>"` e resumo completo (inclua o celular real no resumo)
3. Informar ao cliente: "<mensagem de confirmação>"
```

### 4.7 — Variável `<DadosUsuario>` no agente

Garantir que o texto passado ao agente inclui `canal` e `client_phone` condicional:

```
=<DadosUsuario>
canal: {{ $('Fluxo_Variaveis').item.json.Canal }}
contact_id: {{ $('Merge_Contatos').item.json.contact_id }}
client_name: {{ $('Merge_Contatos').item.json.contact_name }}
client_email: {{ $('Merge_Contatos').item.json.contact_email }}
client_phone: {{ $('Fluxo_Variaveis').item.json.Canal === 'WHATSAPP' ? $('Merge_Contatos').item.json.contact_phone : '' }}
</DadosUsuario>
```

---

## Etapa 5 — Workflow de notificação de stage (se existir)

Atualizar o código do nó `Montar Mensagem` (ou equivalente) para ler os campos enriquecidos. Ver implementação de referência em [workflow `3uxs1Pdmsn17f0ke` Montar Mensagem] (copiar e colar o jsCode).

Campos lidos do payload enriquecido:
- `contact.source` → detecção de canal confiável
- `contact.whatsapp_phone` → celular real quando cliente Instagram forneceu
- `contact.identifiers` → lista completa (para debug/display)
- `deal.title` → fallback pra detectar canal

Exibição:
- 💚 WhatsApp | 📸 Instagram | ❓ Desconhecido
- Telefone: prioriza `whatsapp_phone` → contact.phone (se E.164) → "Não informado"

---

## Etapa 6 — Teste end-to-end

**Pelo WhatsApp:**
1. Enviar mensagem de saudação pra inbox WhatsApp do cliente
2. Verificar execução no n8n: `Encontrar_Cliente_CRM` deve achar contato (se existente) ou cair em `Criar_Contato_CRM` (se novo) sem 409
3. Pedir pra Sofia fazer pedido/reserva
4. Na finalização: `crm_mover_stage` deve retornar 200
5. Notificação chega no WhatsApp da equipe com canal correto e telefone correto

**Pelo Instagram:**
1. Enviar mensagem pela DM
2. Sofia pede o celular (REGRA #1B)
3. Ao fornecer, Sofia chama `adicionar_identifier_contato` (channel=whatsapp)
4. `crm_mover_stage` roda depois — sem erro
5. Notificação mostra:
   - 📸 Canal: Instagram
   - 📱 Telefone: <celular informado> (do whatsapp_phone identifier)

**Se deu erro, checar em ordem:**
1. Execução do n8n → qual nó falhou
2. Resposta do endpoint → `Invalid payload`? `Deal not found`? `Identifier conflict`?
3. Armadilhas conhecidas (seção abaixo)

---

## Armadilhas conhecidas

### A) `Invalid payload` no `crm_mover_stage`
**Causa:** versão do endpoint ainda não tem o preprocess `emptyToUndefined` para strings vazias.
**Fix:** `git pull` + `vercel deploy` no cliente.

### B) `Deal not found for this identity` mesmo com contact_id válido
**Causa:** o contato tem deals, mas TODOS fechados (`is_won=true` ou `is_lost=true`). O endpoint só pega deal aberto.
**Fix:** criar um deal novo via `Criar_Deal_CRM` no fluxo ou ajustar o fluxo pra garantir que existe deal aberto antes do move_stage.

### C) `Identifier already attached to another contact` (409)
**Causa:** outro contato na mesma org já tem aquele `(channel, identifier)`. Tipicamente duplicata histórica.
**Fix:** seguir procedimento de consolidação (ver Etapa 7). Ou ignorar via `neverError: true` no nó (que é o padrão em `Criar_Identifier_Novo`).

### D) Phone do contato não aparece na notificação (mostra "Não informado")
**Causa:** `contact.phone` está armazenando algo que não parece E.164 (ex: IGSID herdado do backfill antes do Sofia trocar). E não tem `(whatsapp, +55...)` identifier cadastrado.
**Fix:** chamar `adicionar_identifier_contato` para registrar o whatsapp phone real, OU consolidar duplicatas (Etapa 7) para o contato canônico ficar com phone real.

### E) Backfill classificou identifier errado
**Causa:** heurística de backfill usa `source` do contato + formato do phone. Contato Instagram cujo `phone` foi trocado para `+5527...` (antes do rollout) vira `(instagram, +5527...)` em vez de `(instagram, <IGSID>)`. Próxima msg do Instagram com IGSID não acha → cria novo contato.
**Fix:** ou esperar o fluxo natural criar o identifier correto no próximo contato novo (vai deduplicar via fallback), ou consolidar manualmente (Etapa 7).

### F) `JSON object requested, multiple (or no) rows returned` no POST /contacts
**Causa:** dedup do POST usava `.maybeSingle()` que falha com >1 row.
**Fix:** `git pull` — já corrigido no main com `order + limit(1)`.

### G) Lookup com `identifier+phone` retornando vazio mesmo existindo contato
**Causa:** versão antiga do endpoint aplicava `AND` entre identifier match e phone filter.
**Fix:** `git pull` — já corrigido no main (identifier match é autoritativo, não aplica phone/email por cima).

### H) Criar_Identifier_Novo quebrando Merge_Contatos
**Causa:** wiring em série (Criar_Identifier_Novo → Merge_Contatos) passa o JSON de erro 409 como input do Merge, corrompendo contact_id.
**Fix:** wiring lateral (Set_Contato_Novo → Merge_Contatos E Set_Contato_Novo → Criar_Identifier_Novo em paralelo).

---

## Etapa 7 — Consolidar duplicatas (opcional, limpeza)

Se há contatos pré-existentes duplicados (mesmo cliente em Instagram e WhatsApp como contatos separados), rodar SQL de consolidação. Exemplo do que foi feito no Empório:

```sql
BEGIN;

-- 1. Definir contato canônico (CANONICAL_ID) e lista de duplicatas (DUP_IDS)
-- Critérios: preferir o que tem mais identifiers ativos, depois mais deals,
-- depois o mais recente. Escolher manualmente caso a caso.

-- 2. Migrar deals
UPDATE deals SET contact_id = '<CANONICAL_ID>', updated_at = NOW()
WHERE contact_id IN (<DUP_IDS>);

-- 3. Migrar activities
UPDATE activities SET contact_id = '<CANONICAL_ID>'
WHERE contact_id IN (<DUP_IDS>);

-- 4. Migrar messaging_conversation_links
UPDATE messaging_conversation_links
SET contact_id = '<CANONICAL_ID>', updated_at = NOW()
WHERE contact_id IN (<DUP_IDS>);

-- 5. Atualizar phone do canônico para o real (se estava com IGSID)
UPDATE contacts SET phone = '<+5527...>', updated_at = NOW()
WHERE id = '<CANONICAL_ID>';

-- 6. Soft-delete identifiers das duplicatas
UPDATE contact_identifiers SET deleted_at = NOW()
WHERE contact_id IN (<DUP_IDS>) AND deleted_at IS NULL;

-- 7. Soft-delete duplicatas
UPDATE contacts SET deleted_at = NOW()
WHERE id IN (<DUP_IDS>);

COMMIT;
```

Query útil pra achar duplicatas:
```sql
-- Phones que aparecem em >1 contato ativo
SELECT phone, COUNT(*) AS count, array_agg(id) AS ids, array_agg(source) AS sources
FROM contacts
WHERE organization_id = '<ORG_ID>' AND deleted_at IS NULL
GROUP BY phone
HAVING COUNT(*) > 1
ORDER BY count DESC;
```

---

## Checklist resumido por cliente

- [ ] **Pré:** CRM do cliente tem git main atualizado + deploy pronto
- [ ] **Etapa 1:** migration `20260422120000_contact_identifiers.sql` aplicada
- [ ] **Etapa 2:** endpoints respondem OK (`/contacts?identifier=`, `/contacts/{id}/identifiers`, `/deals/move-stage-by-identity` com channel+identifier)
- [ ] **Etapa 3:** trigger `notify_stage_change` (ou equivalente) atualizada com payload enriquecido
- [ ] **Etapa 4.1:** `Encontrar_Cliente_CRM` — queryParameters com `identifier+channel+phone`
- [ ] **Etapa 4.2:** `Criar_Identifier_Novo` adicionado como branch lateral (não em série!)
- [ ] **Etapa 4.3:** tool `adicionar_identifier_contato` adicionada ao agente
- [ ] **Etapa 4.4:** `crm_mover_stage` body com `contact_id + channel + identifier + phone + email`
- [ ] **Etapa 4.5:** `update_contato` toolDescription orienta a não usar phone no Instagram
- [ ] **Etapa 4.6:** prompt REGRA #1B + TOOLS table + Etapa 5 do fluxo de pedido atualizados
- [ ] **Etapa 4.7:** `<DadosUsuario>` do agente inclui `canal` e `client_phone` condicional
- [ ] **Etapa 5:** workflow de notificação `Montar Mensagem` atualizado
- [ ] **Etapa 6:** teste end-to-end WhatsApp + Instagram
- [ ] **Etapa 7** (opcional): consolidar duplicatas se houver

---

## Rollback

Se algo der muito errado:

1. **Reverter n8n:** cada workflow tem histórico de versões. Abrir n8n UI → Sofia workflow → History → restaurar versão anterior.
2. **Reverter endpoints:** `git revert <commit>` + `vercel deploy`. As mudanças são backward-compatible (aceitam legacy phone+email também), então mesmo rollback parcial funciona.
3. **Reverter trigger Supabase:** re-rodar a versão anterior via Management API.
4. **Dados:** a migration é aditiva — `contact_identifiers` pode ficar no banco mesmo se reverter código. Não estraga nada.

---

## Próximos clientes

Ordem sugerida para rollout:
1. **Empório Fonseca** ✅ (feito em 2026-04-22/23)
2. **Coronel Picanha** — referência do workflow em `.context/integrations/n8n/[Coronel Picanha] Agente de atendimento.json`
3. **Wine Vix**
4. **Template novo cliente** — incorporar tudo no template padrão para clientes novos nascerem com a arquitetura correta (ver `TEMPLATE_NOVO_CLIENTE.md`)

Cada cliente leva ~30min considerando que todas as armadilhas já foram mapeadas aqui.
