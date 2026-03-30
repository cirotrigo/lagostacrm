# Plano v2.0 — Rollout Operacional Instagram DM (Coronel + Expansão Multi-Cliente)

> **Data:** 2026-02-15  
> **Status:** Pronto para execução  
> **Dependência:** `instagram-dm-platform-v2.md` aprovado e implementado em staging  
> **Objetivo:** Executar implantação repetível para clientes existentes e novos, com governança de risco e rollback
> **Runbooks operacionais:**
> - `.context/plans/instagram-dm-staging-smoke-v2.md`
> - `.context/plans/instagram-dm-rollback-runbook-v2.md`

---

## 1. Fase piloto no Coronel

### 1.1 Objetivo do piloto
- Validar a solução fim a fim em um cliente real com volume controlado.
- Confirmar estabilidade antes de expansão para base completa.

### 1.2 Escopo do piloto
- Organização: Coronel Picanha.
- Canais: WhatsApp (regressão) + Instagram DM (novo).
- Fluxo: resolução de identidade externa, criação/associação de contato, garantia de deal, automações por `deal_id`.

### 1.3 Critérios de saída do piloto
- 7 dias sem incidente crítico.
- Taxa de erro abaixo do limite definido para webhook e tools.
- Zero regressão confirmada no WhatsApp.

---

## 2. Checklist de ativação por cliente

## 2.1 Pré-ativação (T-2)
- Confirmar `organization_id` e permissões admin.
- Validar config Chatwoot ativa e conectividade API.
- Validar webhook endpoint e assinatura.
- Confirmar board/key e stages esperados no CRM.
- Conferir credenciais n8n para a organização.

## 2.2 Ativação (T0)
- Aplicar configurações de canal Instagram na organização.
- Importar/ativar workflow n8n versão v2 para a org.
- Executar smoke test:
  - mensagem WhatsApp,
  - primeira DM Instagram,
  - mudança de estágio por tool com `deal_id`.

## 2.3 Pós-ativação (T+1)
- Monitorar métricas por 24h.
- Auditar logs de identidade e stage move.
- Validar amostra de 10 atendimentos reais.

---

## 3. Backfill para clientes existentes

## 3.1 Objetivo
- Preparar base atual para comportamento multi-canal sem ruptura.

## 3.2 Estratégia
- Backfill de identidades WhatsApp em `messaging_contact_identities` a partir de `contacts.phone`.
- Processamento em batches por organização.
- Registrar conflitos em log para revisão manual.

## 3.3 Regras de segurança de dados
- Não sobrescrever vínculo existente sem validação.
- Em conflito de identidade, manter contato original e abrir tarefa de conciliação.
- Idempotência obrigatória por chave única (`organization_id`, `source`, `external_id`).

---

## 4. Fluxo de onboarding para novos clientes

## 4.1 Padrão de ativação
1. Criar organização via installer.
2. Configurar canal Chatwoot da org.
3. Registrar webhook.
4. Ativar workflow n8n padrão v2.
5. Executar suíte de smoke tests.
6. Liberar produção.

## 4.2 Artefatos obrigatórios por novo cliente
- Planilha/checklist de onboarding preenchida.
- Evidência de testes (capturas/logs).
- Data/hora de go-live e responsável técnico.

---

## 5. Plano de monitoração e rollback

## 5.1 Monitoração (primeiras 72h por cliente)
- Webhook success rate.
- Tempo médio de processamento do fluxo.
- Falhas em resolução de identidade.
- Erros de stage move.
- Conversas sem `contact_id`/`deal_id` após processamento.

## 5.2 Thresholds de alerta
- Webhook 5xx > 2% por 15 min.
- Falha de resolução de identidade > 1% por 30 min.
- Falha de stage move > 1% por 30 min.

## 5.3 Rollback (por organização)
1. Desativar fluxo v2 no n8n da org.
2. Retornar para fluxo anterior estável (fallback).
3. Manter ingestão de mensagens (sem automações críticas).
4. Abrir incidente com RCA inicial em até 2h.

---

## 6. Matriz de risco por etapa

| Etapa | Risco | Probabilidade | Impacto | Mitigação |
|------|-------|---------------|---------|-----------|
| Configuração | Canal/inbox incorreto | Média | Alto | Checklist técnico + validação dupla |
| Go-live | Regressão WhatsApp | Baixa | Alto | Smoke test obrigatório + rollback imediato |
| Produção inicial | Duplicidade de contato | Média | Médio | Chave única por identidade + log de conflito |
| Operação | Stage move em deal errado | Baixa | Alto | Uso obrigatório de `deal_id` nas tools |
| Escala | Divergência entre clientes | Média | Médio | Template único v2 + governança de onboarding |

---

## 7. Runbook de suporte pós-go-live

## 7.1 Incidente: DM não cria contato/deal
- Verificar webhook recebido.
- Verificar resolução de identidade externa.
- Verificar board/stage configurados.
- Reprocessar evento se necessário.

## 7.2 Incidente: Tool não move estágio
- Confirmar `deal_id` no contexto.
- Validar stage label no board da org.
- Validar resposta HTTP da API.

## 7.3 Incidente: Mensagens misturadas entre canais
- Validar chave canônica (`whatsapp:*` vs `instagram:*`) no buffer/memória.
- Validar expressão de `source` no workflow.

## 7.4 Incidente: falha de provider/webhook
- Confirmar status do Chatwoot e n8n.
- Testar endpoint de saúde.
- Aplicar contingência (pausar automação, manter recepção manual).

## 7.5 Comunicação
- Atualização inicial em até 15 min.
- ETA e workaround em até 30 min.
- RCA preliminar em até 2h.

---

## 8. Critérios de sucesso de negócio e operação

## 8.1 Operação
- 99%+ de webhooks processados com sucesso por cliente.
- 0 regressão funcional de WhatsApp após ativação.
- <1% de falhas de resolução de identidade após estabilização.

## 8.2 Produto/negócio
- Instagram DM habilitado sem customização de código por cliente.
- Tempo de ativação de novo cliente <= 1 dia útil após credenciais prontas.
- Redução de esforço operacional por onboarding (processo padronizado).

---

## 9. Cenários de validação obrigatórios

1. Regressão WhatsApp em cliente já ativo.
2. Primeiro DM Instagram em cliente sem histórico.
3. Reentrada de DM Instagram (idempotência).
4. Cliente com múltiplos canais (isolamento de sessão).
5. Falha de webhook/chat provider e recuperação.

---

## 10. Cronograma sugerido (macro)

1. Semana 1: piloto Coronel em staging e produção controlada.
2. Semana 2: estabilização + ajustes.
3. Semana 3: rollout para primeira onda de clientes existentes.
4. Semana 4+: onboarding padrão para novos clientes e expansão por lotes.

---

## Assumptions e defaults
- Escopo é multi-org agora (não Coronel-only).
- Implementação deve ser aditiva e fork-safe.
- Coronel será piloto, não exceção de código.
- Documento escrito em português técnico, pronto para execução.
