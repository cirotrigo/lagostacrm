# Checklist: Novo Cliente em Novo Projeto Vercel

Este guia é o roteiro operacional para subir um novo cliente do zero, validar integrações e confirmar rotinas automáticas.

## 1. Provisionamento inicial

1. Faça fork do repositório.
2. Crie um novo projeto na Vercel apontando para esse fork.
3. Faça o primeiro deploy.
4. Execute o wizard em `https://SEU-PROJETO.vercel.app/install`.
5. Conclua o setup de Supabase e usuário admin.

## 2. Variáveis obrigatórias na Vercel

Configure no ambiente `Production`:

1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ou fallback legado anon key)
3. `SUPABASE_SECRET_KEY` (ou fallback `SUPABASE_SERVICE_ROLE_KEY`)
4. `CRON_SECRET`
5. `N8N_WEBHOOK_SECRET` (quando usar n8n com APIs internas)

Opcional (se webhook assinado no Chatwoot):

1. `CHATWOOT_WEBHOOK_SECRET`

## 3. Cron de sincronização de avatares

O projeto já possui `vercel.json` com:

- path: `/api/cron/sync-chatwoot-avatars`
- schedule: `0 */8 * * *` (3 vezes ao dia, UTC)

Para funcionar corretamente:

1. Garanta que `CRON_SECRET` esteja configurado na Vercel.
2. Faça redeploy após salvar variáveis novas.
3. Confirme no painel Vercel que o cron job aparece ativo.

## 4. Smoke test pós-deploy

### 4.1 Teste do cron com dry-run

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://SEU-PROJETO.vercel.app/api/cron/sync-chatwoot-avatars?dry_run=true"
```

Esperado:

1. HTTP 200
2. JSON com `totals` e `byOrg`

### 4.2 Teste de proteção da rota

```bash
curl -i -sS "https://SEU-PROJETO.vercel.app/api/cron/sync-chatwoot-avatars?dry_run=true"
```

Esperado:

1. HTTP 401 Unauthorized

## 5. Configuração do n8n para APIs internas

Quando usar chamadas para `/api/chatwoot/conversation-links` e endpoints correlatos:

1. Header `Authorization: Bearer <N8N_WEBHOOK_SECRET>`
2. Header `X-Organization-Id: <organization_id>`

Sem `X-Organization-Id`, a API rejeita a requisição no modo integração.

## 6. Go-live checklist

1. Login admin funcionando.
2. CRUD básico de contatos/deals funcionando.
3. Cron responde com 200 em `dry_run`.
4. Webhook/integração n8n autenticando com sucesso.
5. `INSTALLER_ENABLED=false` após setup concluído.
