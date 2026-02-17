# Guia para Leigos — Smoke Test (Instagram DM + WhatsApp)

> **Data:** 2026-02-15  
> **Público:** pessoa não técnica (operações, atendimento, coordenação)  
> **Objetivo:** explicar o que é Smoke Test, para que serve, quando executar e como rodar sem erro.

---

## 1) O que é Smoke Test?

Smoke Test é um teste rápido de saúde do sistema.

Pense nele como “ligar o carro e ver se anda, freia e acende o painel” antes de sair para uma viagem longa.

No nosso caso, o Smoke verifica se a integração de mensagens está funcionando no básico:
- Instagram DM entra no CRM.
- WhatsApp continua funcionando (sem regressão).
- Reenvio do mesmo evento não duplica conversa (idempotência).

---

## 2) Para que serve?

Ele evita colocar em produção algo quebrado.

O Smoke serve para:
- detectar erro de configuração (URL, inbox, webhook, secret);
- confirmar que o deploy novo não quebrou o WhatsApp;
- validar o caminho mínimo antes do piloto/go-live.

---

## 3) Quando executar?

Execute o Smoke obrigatoriamente nestes momentos:

1. Após deploy em **staging** com mudanças de mensageria.
2. Antes de liberar Sprint 2 / piloto do cliente.
3. Antes de cada go-live em cliente novo.
4. Após incidente e antes de reativar fluxo v2 (roll-forward).
5. Após alterações em webhook, Chatwoot config, ou resolução de identidade.

---

## 4) O que você precisa antes de começar

Você precisa de:
- acesso ao terminal do projeto;
- arquivo `.env.smoke.local` preenchido;
- URL do staging;
- IDs de conta/inboxes no Chatwoot;
- um IGSID de teste e um número WhatsApp de teste.

---

## 5) Onde encontrar cada valor

- `SMOKE_BASE_URL`:
  URL do staging do CRM, exemplo `https://staging.seudominio.com`.

- `SMOKE_CHATWOOT_ACCOUNT_ID`:
  ID da conta no Chatwoot (numérico).

- `SMOKE_CHATWOOT_INBOX_INSTAGRAM_ID`:
  ID da inbox Instagram no Chatwoot (numérico).

- `SMOKE_CHATWOOT_INBOX_WHATSAPP_ID`:
  ID da inbox WhatsApp no Chatwoot (numérico).

- `SMOKE_INSTAGRAM_IGSID`:
  identificador do contato Instagram para teste.

- `SMOKE_WHATSAPP_PHONE`:
  telefone em formato E.164, exemplo `+5511999990000`.

- `SMOKE_CHATWOOT_WEBHOOK_SECRET` (opcional):
  preencha se o endpoint exige assinatura.

- `SMOKE_ORGANIZATION_ID` (opcional):
  use para forçar organização específica durante o teste.

---

## 6) Passo a passo completo (sem atalhos)

### Passo 1 — Abra o projeto no terminal

No terminal, entre na pasta do projeto:

```bash
cd "/Users/cirotrigo/Documents/Agente Coronel Picanha/lagostacrm"
```

### Passo 2 — Abra o arquivo de variáveis

Arquivo pronto:

- `.env.smoke.local`

Preencha os valores reais nos campos `SMOKE_*`.

### Passo 3 — Carregue as variáveis no terminal

```bash
set -a
source .env.smoke.local
set +a
```

Esse passo “ativa” as variáveis para o comando de smoke.

### Passo 4 — Execute o Smoke

```bash
npm run smoke:integrations
```

### Passo 5 — Interprete o resultado

Sucesso esperado:
- todos os cenários com `PASS`;
- final sem erro;
- comando termina com status 0.

Se falhar:
- você verá `FAIL` em um ou mais cenários;
- ou mensagem de variável faltando;
- ou erro HTTP (ex.: 400/401/500).

---

## 7) Erros comuns e correção rápida

1. **“Missing required env vars”**
- Causa: arquivo não preenchido ou não carregado.
- Correção: revisar `.env.smoke.local` e repetir `set -a; source ...; set +a`.

2. **401 Invalid signature**
- Causa: secret diferente do configurado no webhook.
- Correção: ajustar `SMOKE_CHATWOOT_WEBHOOK_SECRET`.

3. **400 Organization not found / Ambiguous mapping**
- Causa: account/inbox mapeado incorretamente.
- Correção: revisar IDs de account/inbox e, se necessário, definir `SMOKE_ORGANIZATION_ID`.

4. **500 Internal server error**
- Causa: erro no backend ou configuração incompleta.
- Correção: coletar logs e seguir runbook de rollback.

---

## 8) O que fazer depois de rodar

1. Guardar o log do comando (`npm run smoke:integrations`).
2. Executar as queries SQL de validação do documento:
   - `.context/plans/instagram-dm-staging-smoke-v2.md`
3. Registrar decisão Go/No-Go.
4. Se falhou, abrir incidente e aplicar:
   - `.context/plans/instagram-dm-rollback-runbook-v2.md`

---

## 9) Referências rápidas

- Smoke técnico: `.context/plans/instagram-dm-staging-smoke-v2.md`
- Rollback: `.context/plans/instagram-dm-rollback-runbook-v2.md`
- Script executado: `scripts/smoke-chatwoot-webhook.mjs`
- Comando principal: `npm run smoke:integrations`
