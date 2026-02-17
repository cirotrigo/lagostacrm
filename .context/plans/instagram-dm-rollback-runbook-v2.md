# Runbook v2.0 — Rollback Operacional Instagram DM

> **Data:** 2026-02-15  
> **Objetivo:** rollback rápido por organização, preservando operação de atendimento enquanto o incidente é tratado.

---

## 1. Quando acionar rollback

Acionar rollback por organização quando ocorrer qualquer condição:
- Webhook `5xx` > 2% por 15 minutos.
- Falha de resolução de identidade > 1% por 30 minutos.
- Falha de stage move > 1% por 30 minutos.
- Regressão WhatsApp confirmada.
- Duplicidade relevante de contato/conversa com impacto operacional.

---

## 2. Responsáveis e SLA

- Incident Commander: Engenharia de Integrações.
- Operação CRM: valida impacto com atendimento.
- Comunicação: responsável pelo cliente.

SLA operacional:
- Início do diagnóstico: até 15 min.
- Workaround/rollback aplicado: até 30 min.
- RCA preliminar: até 2h.

---

## 3. Procedimento de rollback (por organização)

1. Congelar ativações novas para a organização afetada.
2. Desativar workflow n8n v2 da organização.
3. Reativar fluxo anterior estável (fallback) da organização.
4. Manter recepção de mensagens no Chatwoot sem automações críticas.
5. Confirmar que webhooks voltaram a responder sem erro.
6. Validar atendimento manual assistido em 3 conversas reais.
7. Abrir incidente com timeline e hipóteses iniciais.

---

## 4. Verificação pós-rollback

Checklist técnico:
- Endpoint webhook sem erro 5xx.
- Novas conversas com vínculo em `messaging_conversation_links`.
- WhatsApp operacional sem perda de mensagens.
- Sem aumento contínuo de erros em `messaging_identity_resolution_log`.

Checklist funcional:
- Time de atendimento consegue responder normalmente.
- Stage move crítico voltou ao fluxo estável anterior.
- Cliente ciente da contingência e ETA de correção.

---

## 5. Estratégia de retorno (roll-forward)

Pré-condições para retomar v2:
- Correção aplicada e revisada.
- Smoke staging 100% aprovado.
- Janela de implantação definida.

Passos:
1. Reativar v2 em janela controlada.
2. Monitorar 30 min com alertas reforçados.
3. Validar cenários Instagram + WhatsApp + idempotência.
4. Encerrar incidente após estabilização.

---

## 6. Template de comunicação

Mensagem inicial:
- "Identificamos instabilidade no fluxo de mensageria da organização `<ORG>`. Iniciamos rollback controlado para manter atendimento ativo. Próxima atualização em até 30 minutos."

Mensagem de estabilização:
- "Rollback concluído com sucesso na organização `<ORG>`. Atendimento estabilizado no fluxo de contingência. Seguimos com análise de causa e plano de retorno seguro para v2."

---

## 7. Evidências obrigatórias do incidente

- Horário de detecção, gatilho e decisão de rollback.
- Logs de erro (webhook, identidade, stage move).
- Horário de restauração operacional.
- Ações corretivas e data do novo go-live.
