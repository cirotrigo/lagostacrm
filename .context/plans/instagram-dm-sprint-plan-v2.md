# Plano por Sprint v2.0 — Instagram DM (Multi-Org / Fork-Safe)

> **Objetivo:** quebrar a execução da v2.0 em sprints com entregáveis, critérios de aceite e gates de avanço.  
> **Referências:**  
> - `.context/plans/instagram-dm-platform-v2.md`  
> - `.context/plans/instagram-dm-rollout-v2.md`  
> - `.context/plans/instagram-dm-execution-checklist-v2.md`
> - `.context/plans/instagram-dm-staging-smoke-v2.md`
> - `.context/plans/instagram-dm-rollback-runbook-v2.md`

---

## Premissas de execução

- Cadência sugerida: 3 sprints sequenciais.
- Cada sprint só avança após gate de qualidade (DoD) aprovado.
- Escopo é multi-org (sem hardcode por cliente).
- Implementação aditiva e compatível com sync de fork.

---

## Status Atual (2026-02-15)

- **Sprint 1:** em progresso (parcial, base implementada).
- **Sprint 2:** não iniciada (bloqueada pelo gate da Sprint 1).
- **Sprint 3:** não iniciada.

### Evidências validadas no código
- Migrations criadas para identidade (`20260218010000`), unicidade de config (`20260218011000`) e log de resolução (`20260218012000`).
- Serviço de resolução de identidade e chave canônica implementados em `lib/messaging/`.
- Auditoria de resolução integrada em runtime no serviço de identidade (`messaging_identity_resolution_log`).
- Webhook adaptado para resolver identidade por canal em `lib/chatwoot/webhooks.ts`.
- Webhook com resolução de organização mais robusta por `account_id + inbox_id` em `app/api/chatwoot/webhook/route.ts`.
- Config legado ajustado para comportamento multi-canal determinístico em `lib/chatwoot/config.ts`.
- Script de backfill WhatsApp criado em `scripts/backfill-whatsapp-identities.ts`.
- Testes unitários iniciais adicionados para identidade canônica em `lib/messaging/identityKey.test.ts`.
- `typecheck` está verde após ajuste técnico no webhook.

### Bloqueadores para liberar Sprint 2
- Validar migrations em ambiente limpo e staging (incluindo rollback controlado).
- Expandir suíte para regressão WhatsApp fim a fim em staging (além dos unit/integration já criados).
- Executar smoke completo de webhook com cenários Instagram/WhatsApp em staging.

---

## Sprint 1 — Fundação da Plataforma

### Objetivo
- Entregar base técnica segura para identidade externa por canal e configuração multi-canal por organização.

### Entregáveis
- Migration `messaging_contact_identities` com constraints/índices/RLS.
- Ajuste de modelagem de `messaging_channel_configs` para reduzir ambiguidade multi-canal.
- Serviços de resolução de identidade externa (WhatsApp/Instagram) com idempotência.
- Padronização de chave canônica de sessão/buffer por canal.
- Testes unitários e de integração da camada de identidade/config.

### Backlog do sprint
- [x] Criar migrations aditivas.
- [ ] Validar migrations em staging e ambiente limpo.
- [x] Implementar utilitário de chave canônica (`whatsapp:*` / `instagram:*`).
- [x] Implementar serviço de resolução de identidade externa por `organization_id + source + external_id`.
- [x] Definir fallback seguro por `phone/email` sem colidir identidades.
- [x] Integrar escrita no log de resolução (`messaging_identity_resolution_log`).
- [ ] Cobrir cenários de idempotência e conflito com testes automatizados (além dos unitários já criados).
- [ ] Publicar documentação técnica curta dos contratos internos.

### DoD (Definition of Done)
- [ ] Migrations aplicam sem quebra em ambiente com dados existentes.
- [ ] Resolução de identidade passa em testes de conflito e reprocessamento.
- [ ] WhatsApp legado continua funcional em testes de regressão.

### Gate para Sprint 2
- **Gate atual: BLOQUEADO**.
- Condições para desbloqueio:
- Validar migrations em ambiente limpo/staging.
- Entregar suíte mínima de testes de regressão e idempotência.

---

## Sprint 1.1 — Hardening (novo)

### Objetivo
- Fechar riscos técnicos da fundação antes do piloto operacional.

### Backlog do sprint
- [x] Resolver o estado da migração removida (`20260215000000_messaging_chat_v2.sql`) com estratégia explícita de compatibilidade.
- [x] Integrar auditoria de resolução no runtime (`messaging_identity_resolution_log`).
- [x] Ajustar lookup legado de config para comportamento multi-canal sem ambiguidade.
- [x] Criar testes unitários iniciais do módulo `lib/messaging/*`.
- [x] Criar testes de integração do webhook com cenários Instagram/WhatsApp e reentrada idempotente.

### DoD (Definition of Done)
- [ ] Sem regressão em `typecheck`, lint e testes relevantes.
- [ ] Cenários obrigatórios de identidade passam em CI.
- [ ] Gate da Sprint 1 liberado.

---

## Sprint 2 — Integração de Fluxo + Piloto Coronel

### Objetivo
- Integrar n8n/template v2 com o CRM e validar operação real em piloto controlado.

### Entregáveis
- Template n8n v2 com `deal_id` obrigatório para stage move.
- Integração do fluxo com resolução de identidade externa.
- Piloto Coronel ativo com monitoramento.
- Runbook inicial de incidentes (versão operacional).

### Backlog do sprint
- [ ] Atualizar variáveis do fluxo (`source`, `external_id`, identidade canônica).
- [ ] Garantir que contato/deal seja resolvido no início do fluxo e propague `deal_id`.
- [ ] Migrar tools de stage move para operação por `deal_id`.
- [ ] Configurar alertas de erro (webhook, identidade, stage move).
- [ ] Executar smoke tests completos em staging e produção controlada.
- [ ] Rodar piloto Coronel por janela mínima definida.

### DoD (Definition of Done)
- [ ] Cenários obrigatórios do piloto aprovados.
- [ ] Zero regressão crítica em WhatsApp.
- [ ] Logs/alertas operacionais ativos e úteis para suporte.

### Gate para Sprint 3
- Piloto Coronel estabilizado e aprovado para expansão.

---

## Sprint 3 — Backfill + Escala para Base de Clientes

### Objetivo
- Expandir com segurança para clientes existentes e institucionalizar onboarding padrão para novos clientes.

### Entregáveis
- Backfill de identidades externas para clientes existentes.
- Rollout em ondas por organização.
- Checklist de ativação por cliente operacionalizado.
- Onboarding padrão para novos clientes com template v2.
- Critério formal de Go/No-Go para produção ampla.

### Backlog do sprint
- [ ] Executar backfill em batches com logs de conflito.
- [ ] Definir e executar ondas de rollout (prioridade por risco/volume).
- [ ] Validar smoke test por organização ativada.
- [ ] Monitorar 72h por cliente após ativação.
- [ ] Incorporar setup de Instagram DM no onboarding padrão.
- [ ] Consolidar indicadores de sucesso técnico e operacional.

### DoD (Definition of Done)
- [ ] Clientes da primeira onda operando com estabilidade.
- [ ] Processo repetível para novos clientes validado.
- [ ] Critérios de sucesso do plano de rollout atingidos.

### Gate de encerramento
- Aprovação de produção ampla com relatório final (resultados, riscos residuais e próximos passos).

---

## Dependências e riscos transversais

- Dependência de configuração correta no Chatwoot por organização.
- Dependência de credenciais e ambiente n8n por cliente.
- Risco de conflito de identidade em base legada mitigado por backfill e revisão manual.
- Risco de falha de provider/webhook mitigado por alertas e rollback por organização.

---

## Indicadores mínimos por sprint

### Sprint 1
- Taxa de sucesso em testes de identidade/idempotência.
- Número de conflitos detectados em base de teste.

### Sprint 2
- Taxa de erro webhook.
- Taxa de erro de stage move por `deal_id`.
- Incidentes de regressão WhatsApp.

### Sprint 3
- Tempo médio de ativação por cliente.
- Taxa de sucesso de smoke test por onda.
- Incidentes pós-go-live por organização.
