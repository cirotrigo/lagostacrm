# Checklist de Execução v2.0 — Instagram DM (Arquitetura + Rollout)

> **Objetivo:** checklist operacional único para executar a v2.0 ponta a ponta.  
> **Planos-base:**  
> - `.context/plans/instagram-dm-platform-v2.md`  
> - `.context/plans/instagram-dm-rollout-v2.md`
> - `.context/plans/instagram-dm-sprint-plan-v2.md`
> - `.context/plans/instagram-dm-staging-smoke-v2.md`
> - `.context/plans/instagram-dm-rollback-runbook-v2.md`

---

## 1) Preparação técnica

- [ ] Validar branch de trabalho (`project/lagostacrm` ou `feature/*`), nunca `main`.
- [ ] Revisar escopo multi-org (sem hardcode por cliente).
- [ ] Confirmar estratégia aditiva e fork-safe.
- [ ] Confirmar dependências de Chatwoot, n8n e credenciais por organização.

---

## 2) Banco e modelagem

- [ ] Criar migration de identidades externas por canal (`messaging_contact_identities`).
- [ ] Criar constraints/índices de idempotência por `organization_id + source + external_id`.
- [ ] Ajustar modelagem de `messaging_channel_configs` para evitar ambiguidade multi-canal.
- [ ] Validar RLS das novas estruturas.

---

## 3) Serviços e API

- [ ] Implementar resolução de contato por identidade externa (Instagram/WhatsApp).
- [ ] Garantir retorno e uso de `deal_id` nas automações.
- [ ] Padronizar chave canônica de sessão/buffer por canal.
- [ ] Preservar compatibilidade com fluxo legado (`phone/email`) para WhatsApp.

---

## 4) Workflow n8n (template v2)

- [ ] Atualizar variáveis de canal (`source`, `external_id`, identidade canônica).
- [ ] Resolver contato/deal no início do fluxo e propagar `deal_id`.
- [ ] Migrar tools de stage move para operar por `deal_id`.
- [ ] Confirmar isolamento de memória/buffer por chave canônica.

---

## 5) Backfill e migração de base existente

- [ ] Executar backfill de identidades WhatsApp para clientes existentes.
- [ ] Registrar conflitos de identidade para revisão manual.
- [ ] Garantir que processo é idempotente e seguro para rerun.

---

## 6) Piloto Coronel

- [ ] Ativar piloto no Coronel com monitoramento reforçado.
- [ ] Validar regressão WhatsApp.
- [ ] Validar primeiro contato Instagram sem histórico.
- [ ] Validar reentrada de DM (idempotência).
- [ ] Validar stage moves por `deal_id`.

---

## 7) Rollout para clientes existentes

- [ ] Definir ondas de ativação por risco/volume.
- [ ] Aplicar checklist de ativação por cliente.
- [ ] Executar smoke tests por organização.
- [ ] Monitorar 72h por cliente ativado.

---

## 8) Onboarding de novos clientes

- [ ] Incorporar setup de Instagram DM no processo padrão de onboarding.
- [ ] Garantir template n8n v2 como padrão.
- [ ] Coletar evidências de validação antes de go-live.

---

## 9) Observabilidade e operação

- [ ] Definir alertas (webhook error rate, falhas de identidade, falhas de stage move).
- [ ] Definir SLO e thresholds de rollback.
- [ ] Publicar runbook de incidentes para suporte e engenharia.

---

## 10) Go/No-Go de produção ampla

- [ ] Critérios técnicos do plano de plataforma aprovados.
- [ ] Critérios operacionais do plano de rollout aprovados.
- [ ] RCA de incidentes do piloto concluída (se houver).
- [ ] Aprovação final para expansão total da base.
