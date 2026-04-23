# Contact Identifiers — Roadmap de Execução

> **Para rollout em novo cliente, usar o playbook operacional:** [CONTACT_IDENTIFIERS_PLAYBOOK.md](CONTACT_IDENTIFIERS_PLAYBOOK.md)
>
> Esse roadmap descreve as fases em alto nível. O playbook tem o checklist passo-a-passo com todas as armadilhas descobertas durante o rollout do Empório.

## Status atual (2026-04-23)

**Fase 1 — Infraestrutura: ✅ DEPLOYADA NO EMPÓRIO**
**Fase 2 — n8n usando identifiers: ✅ DEPLOYADA NO EMPÓRIO**
**Fase 3 — Merge automático: ⏳ PENDENTE**
**Fase 4 — Cleanup `contacts.phone`: ⏳ PENDENTE**

**Clientes:**
- Empório Fonseca — Fases 1+2 completas (2026-04-23)
- Coronel Picanha — pendente
- Wine Vix — pendente

---

## Fase 1 — Infraestrutura (completa no código)

Entregue e deployado no main:

- `supabase/migrations/20260422120000_contact_identifiers.sql` — tabela, índices, RLS, trigger, backfill, view `contacts_with_identifiers`
- `app/api/public/v1/contacts/route.ts` — `GET` estendido com filtros `identifier` e `channel`; dedup do POST tolera múltiplos matches
- `app/api/public/v1/contacts/[contactId]/identifiers/route.ts` — `GET` (listar) e `POST` (adicionar/upsert, retorna 409 em conflito cross-contact)
- `app/api/public/v1/contacts/[contactId]/identifiers/[identifierId]/route.ts` — `DELETE` (soft-delete)
- `app/api/public/v1/deals/move-stage-by-identity/route.ts` — aceita `contact_id`, `channel+identifier` além de phone/email; preprocess de empty-strings para tolerar templates n8n
- `lib/public-api/dealsMoveStage.ts` — resolve identidade em ordem: `contact_id > (channel,identifier) > phone/email`

**Compatibilidade:** nenhuma funcionalidade existente é afetada. `contacts.phone` continua sendo lido e escrito como antes. A nova tabela é aditiva.

**Bugs corrigidos durante o rollout do Empório:**
- POST /contacts dedup com `.maybeSingle()` falhava em phones duplicados → trocado por `order + limit(1)`
- GET /contacts aplicava `AND` entre identifier match e phone/email filters → agora identifier match é autoritativo, sem filtros adicionais
- move-stage-by-identity Zod rejeitava `contact_id=""` de templates n8n → preprocess `emptyToUndefined` em todos os campos opcionais

---

## Deploy da Fase 1 (checklist)

Executar em cada CRM multi-tenant (Empório Fonseca, Coronel Picanha, Wine Vix, próximos):

1. **Aplicar migration** no Supabase do cliente
   ```bash
   # via Supabase MCP ou CLI:
   supabase db push --project-ref <ref-do-cliente>
   ```
   A migration é idempotente (`CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING` no backfill).

2. **Deploy do código** (Next.js/Vercel) do CRM
   ```bash
   git push origin main  # se cada cliente tiver branch própria, ajustar
   ```

3. **Verificar** com curl
   ```bash
   curl -H "X-Api-Key: ncrm_..." \
        "https://<cliente>.vercel.app/api/public/v1/contacts?identifier=<IGSID>&channel=instagram"
   # deve retornar o contato do IGSID
   ```

4. **Verificar backfill**
   ```sql
   SELECT channel, COUNT(*) FROM contact_identifiers GROUP BY channel;
   -- esperado: whatsapp e instagram populados
   ```

---

## Fase 2 — n8n passa a usar identifiers (por cliente)

**✅ Procedimento completo documentado em [CONTACT_IDENTIFIERS_PLAYBOOK.md](CONTACT_IDENTIFIERS_PLAYBOOK.md).** A seção abaixo é overview — use o playbook para executar.

**Escopo:** substituir o lookup por `phone` pelo lookup por `(channel, identifier)` nos workflows do agente.

### Mudanças no workflow do agente (ex: `TvNXUETbiNy2mE5k` Empório)

#### 2.1 `Fluxo_Variaveis` — expor `ChannelIdentifier`

Adicionar variável:
```
ChannelIdentifier = {
  whatsapp: body.sender?.phone_number (E.164)
  instagram: body.sender?.identifier (IGSID)
}
ChannelLower = Canal.toLowerCase()
```

Já temos `ClienteIdentificador` — é quase isso. Só precisa garantir que ele pegue o IGSID no Instagram e o phone_number no WhatsApp.

#### 2.2 `Encontrar_Cliente_CRM` — trocar query

Antes:
```
GET /api/public/v1/contacts?phone={ClienteTelefone}
```

Depois:
```
GET /api/public/v1/contacts?identifier={ChannelIdentifier}&channel={ChannelLower}
```

#### 2.3 `Criar_Contato_CRM` — criar contato + identifier

Após `POST /contacts` criar o contato, chamar:
```
POST /api/public/v1/contacts/{contact_id}/identifiers
Body: { "channel": "instagram", "identifier": "<IGSID>", "is_primary": true }
```

Para canal WhatsApp, o identifier é o próprio phone — mas ainda assim vale criar a linha em `contact_identifiers` pra consistência.

#### 2.4 `update_contato` — comportamento novo no Instagram

Quando o cliente Instagram fornece o celular real:
- **NÃO** trocar o `phone` do contato (hoje quebra a busca)
- Em vez disso, chamar `POST /contacts/{id}/identifiers` com `channel=whatsapp, identifier=<celular>`
- Opcional: atualizar `contacts.phone` também (se vier vazio)

#### 2.5 `crm_mover_stage` — endpoint aceita identifier

Atualmente o endpoint `/deals/move-stage-by-identity` só aceita `phone/email`. Adicionar suporte a:
```json
{
  "board_key_or_id": "...",
  "channel": "instagram",
  "identifier": "<IGSID>",
  "to_stage_label": "..."
}
```

A função `moveStageByIdentity` em [lib/public-api/dealsMoveStage.ts](../lib/public-api/dealsMoveStage.ts) passa a resolver contact ids via `contact_identifiers` quando receber `channel+identifier`.

#### 2.6 Reverter o hack de ordenação no prompt

Remover a instrução "chame `crm_mover_stage` antes de `update_contato`" — com identifiers, a ordem não importa mais.

### Checklist por cliente

- [ ] Empório Fonseca (`TvNXUETbiNy2mE5k`)
- [ ] Coronel Picanha (ver pasta `.context/integrations/n8n/`)
- [ ] Wine Vix
- [ ] Próximos (template)

---

## Fase 3 — Merge automático cross-channel

**Objetivo:** quando a Sofia descobre o celular real do cliente Instagram, o sistema detecta que já existe um contato WhatsApp com aquele número e faz merge automático.

### Lógica do merge

Novo endpoint `POST /api/public/v1/contacts/{contactId}/merge-from-identifier`:

```typescript
// 1. Dado: contact_id (Instagram) + novo identifier (whatsapp, +5527...)
// 2. Buscar se já existe OUTRO contato com esse (channel, identifier) na org
// 3. Se existe:
//    - migrar todos os deals do contato Instagram para o contato WhatsApp
//    - migrar atividades (tasks, notes)
//    - migrar contact_identifiers (Instagram identifier passa a pertencer ao WhatsApp contact)
//    - soft-delete o contato Instagram
//    - atualizar messaging_conversation_links: contact_id = contato preservado
//    - retornar: { merged: true, into_contact_id: "...", deleted_contact_id: "..." }
// 4. Se não existe:
//    - apenas adicionar o identifier no contato Instagram
//    - retornar: { merged: false }
```

Sofia passa a chamar esse endpoint em vez de `update_contato` quando recebe celular no Instagram.

### Edge cases

- Cliente WhatsApp existente com phone `+5527...` e cliente Instagram novo com phone=IGSID → merge natural quando celular é informado
- Dois contatos Instagram com phones IGSID diferentes (conversas diferentes no mesmo Messenger) → sem merge, cada um fica separado
- Conflito: dois contatos ambos ativos, ambos com deals — preferir preservar o mais antigo; mover deals do mais novo

---

## Fase 4 — Limpeza: `contacts.phone` = só telefone real

**Objetivo:** remover a sobrecarga do campo `phone`. A partir daqui:
- `contacts.phone` = apenas telefones E.164 reais (WhatsApp, SMS)
- IDs externos (IGSID, PSID, Telegram ID) ficam só em `contact_identifiers`

### Migration de limpeza

```sql
-- Para cada contato em que phone parece um ID externo, mover pra identifier (se não tiver)
-- e limpar contacts.phone
UPDATE contacts SET phone = NULL
WHERE phone IS NOT NULL
  AND phone !~ '^\+[0-9]{10,15}$'  -- não é E.164
  AND id IN (
    SELECT contact_id FROM contact_identifiers
    WHERE channel IN ('instagram','messenger','telegram')
  );
```

### Atualizações

- Notificação de stage: `contact.phone || primary_whatsapp_identifier`
- Web UI do CRM: seção "Canais" do contato mostra todos os identifiers
- Endpoints POST/PATCH `/contacts` validam `phone` como E.164 apenas

---

## Futuro (Fase 5+): canais novos sem mudança de schema

Adicionar Telegram, SMS, Slack, Email transacional → só precisa:
1. Adicionar o nome do canal ao CHECK constraint da tabela
2. Sofia/bots começam a criar identifiers naquele canal
3. Merge automático funciona out-of-the-box

---

## Ordem recomendada para rodar

1. **Agora (automatizado):** merge PR com Fase 1 → deploy em cada CRM → rodar migrations
2. **Próximo cliente:** já nasce com modelo novo. Nada manual.
3. **Empório (1º a migrar n8n):** executar Fase 2 no workflow do agente; validar 1-2 semanas
4. **Demais clientes:** replicar Fase 2 em cada workflow n8n
5. **Quando todos os clientes estiverem estáveis na Fase 2:** Fase 3 (merge automático) + Fase 4 (cleanup)

---

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Backfill preenche channel errado (ex: IGSID classificado como WhatsApp) | Heurística conservadora: só classifica INSTAGRAM se source confirmar OU dígitos >= 14 sem '55'. Demais caem em 'other'. Revisão manual por cliente. |
| Endpoint novo pode ser chamado sem channel → performance | Índice `(organization_id, identifier)` cobre a query sem channel. |
| Durante Fase 2 (transição), convivem lookups por phone e por identifier | OK — ambos funcionam porque Fase 1 é aditiva. |
| Merge de contatos em produção mistura históricos | Na Fase 3 o merge só roda com confirmação explícita (não é automático em todos os PATCH). Logs de auditoria. |

---

## Arquivos criados nesta entrega

- `supabase/migrations/20260422120000_contact_identifiers.sql`
- `app/api/public/v1/contacts/route.ts` (modificado)
- `app/api/public/v1/contacts/[contactId]/identifiers/route.ts`
- `app/api/public/v1/contacts/[contactId]/identifiers/[identifierId]/route.ts`
- `docs/CONTACT_IDENTIFIERS_ROADMAP.md` (este arquivo)
