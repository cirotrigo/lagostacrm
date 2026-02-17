# Plano v2.0 — Plataforma Multi-Org para Instagram DM (Fork-Safe)

> **Data:** 2026-02-15  
> **Status:** Pronto para implementação  
> **Escopo:** Plataforma multi-tenant (todas as organizações), sem hardcode de cliente  
> **Objetivo:** Suportar Instagram DM com compatibilidade WhatsApp, baixo risco de conflito em sync de fork com upstream

---

## 1. Problemas atuais de escala

### 1.1 Acoplamento por cliente
- Fluxos e integrações estão orientados ao cliente atual (Coronel), dificultando replicação para outros clientes.
- Customizações locais por cliente aumentam custo de manutenção e retrabalho.

### 1.2 Identidade de contato incompleta para canal social
- A plataforma depende principalmente de `phone`/`email`.
- Para Instagram DM, `phone` pode ser nulo; isso cria risco de duplicidade, lookup inconsistente e falhas de idempotência.

### 1.3 Ambiguidade em configuração de canal por organização
- A modelagem de `messaging_channel_configs` e seu uso atual não deixam claro o cenário de múltiplos canais ativos por organização.
- Resultado: risco de comportamento não determinístico em webhook/SDK e na operação de múltiplos inboxes.

### 1.4 Risco em automações de stage por identidade
- Fluxos baseados em identidade (`phone/email`) podem mover deal errado quando há múltiplos deals abertos.
- Falta padronização para uso de `deal_id` como chave primária de automação.

### 1.5 Risco de conflito em sync fork
- Alterações extensas em arquivos centrais do core aumentam conflitos de merge com upstream.
- É necessário adotar mudanças aditivas, isoladas por feature e orientadas por dados.

---

## 2. Arquitetura alvo multi-org

### 2.1 Princípios
- **Configuração por organização:** nenhum comportamento hardcoded por cliente.
- **Aditivo e fork-safe:** priorizar novas tabelas, novas funções e extensões de rota compatíveis.
- **Canal-agnóstico:** WhatsApp e Instagram no mesmo contrato de automação.
- **Determinístico:** usar `deal_id` para mutações de estágio.

### 2.2 Fluxo alvo (alto nível)
1. Chatwoot recebe mensagem de qualquer canal.
2. n8n extrai `source` e identificador externo canônico.
3. CRM resolve/associa contato por identidade externa.
4. CRM garante deal aberto no board configurado.
5. Agente usa tools para mover estágio por `deal_id`.
6. Chat/memória/buffer usam chave canônica por canal.

### 2.3 Chave canônica de sessão/buffer
- `whatsapp:<phone_e164>`
- `instagram:<external_id>`

Regra:
- Proibido fallback para `name` ou valor genérico (`unknown`) em chave de identidade.
- Sem identificador externo válido, evento deve ser marcado como inválido e não processado pelo agente.

---

## 3. Mudanças de schema aditivas

## 3.1 Identidade externa por canal
**Nova migration (aditiva):**
- `supabase/migrations/20260218010000_messaging_contact_identities.sql`

**Nova tabela:**
- `public.messaging_contact_identities`

**Colunas mínimas:**
- `id UUID PK`
- `organization_id UUID NOT NULL`
- `contact_id UUID NOT NULL`
- `source TEXT NOT NULL` (enum lógico: `WHATSAPP`, `INSTAGRAM`)
- `external_id TEXT NOT NULL`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`

**Constraints e índices:**
- `UNIQUE (organization_id, source, external_id)` (idempotência por identidade externa)
- `INDEX (organization_id, contact_id)`
- `INDEX (organization_id, source)`

**RLS:**
- Mesmo padrão das demais tabelas de mensageria por `organization_id`.

## 3.2 Evolução da configuração de canais
**Migration aditiva de robustez:**
- `supabase/migrations/20260218011000_messaging_channel_configs_uniques.sql`

**Ajustes:**
- Garantir chave única coerente para o uso real da tabela em ambiente multi-canal.
- Sugestão base: `UNIQUE (organization_id, channel_type, name)`.
- Para webhooks por inbox: índice auxiliar em `(organization_id, chatwoot_inbox_id)` quando não nulo.

## 3.3 Auditoria técnica opcional (recomendado)
**Nova tabela opcional:**
- `public.messaging_identity_resolution_log`

Objetivo:
- auditar resolução de identidade em casos ambíguos (conflito de contato, missing identifier, merge manual).

---

## 4. Mudanças de API/serviços

## 4.1 Resolver identidade externa por canal (sem hardcode)
Adicionar suporte de identidade externa em serviços de contato/deal com comportamento determinístico:

- Resolver contato por:
  1. `organization_id + source + external_id` (prioridade 1)
  2. fallback por `phone/email` (quando disponível e seguro)
- Criar vínculo em `messaging_contact_identities` ao criar/associar contato.

## 4.2 Garantir `deal_id` nas automações de stage move
- No onboarding do fluxo, sempre resolver/retornar `deal_id`.
- Em tools de IA, mutações de estágio devem usar `deal_id`.
- Endpoint de movimento por identidade permanece para compatibilidade, mas fluxo recomendado é por `deal_id`.

## 4.3 Padronizar chave de sessão/buffer por canal
- Introduzir utilitário comum (ex.: `lib/messaging/identityKey.ts`) para gerar chave canônica.
- n8n e memória Redis devem usar a mesma convenção.

## 4.4 Corrigir modelagem de config de canal por organização
- Ajustar acesso de configuração para evitar `.single()` ambíguo quando houver mais de um canal.
- API de config deve retornar:
  - configuração ativa por canal/inbox, ou
  - erro explícito de ambiguidade com instrução de correção.

## 4.5 Mudanças de interface (definidas neste plano)
1. Resolver identidade externa por canal (Instagram/WhatsApp) sem hardcode por cliente.
2. Garantir `deal_id` nas automações de stage move.
3. Padronizar chave canônica de sessão/buffer por canal.
4. Corrigir modelagem de config de canal por organização para suportar múltiplos cenários sem ambiguidade.

---

## 5. Compatibilidade retroativa

### 5.1 WhatsApp legado
- Fluxos atuais continuam funcionando com `phone` como identidade principal.
- Nova tabela de identidades externas é aditiva e não quebra contrato existente.

### 5.2 Endpoints legados
- `move-stage-by-identity` permanece compatível para clientes já integrados.
- Documentar `move-stage` com `deal_id` como caminho preferencial.

### 5.3 Migração gradual por organização
- Ativação do comportamento multi-canal por organização via configuração/flag.
- Sem necessidade de “big bang” para todos os clientes simultaneamente.

---

## 6. Estratégia de migração/backfill

## 6.1 Ordem de execução técnica
1. Aplicar migrations aditivas.
2. Publicar serviços/API compatíveis.
3. Backfill de identidades WhatsApp para base existente.
4. Ativar piloto no Coronel.
5. Expandir por ondas para clientes existentes.
6. Tornar padrão para novos clientes no onboarding.

## 6.2 Backfill (clientes existentes)
- Popular `messaging_contact_identities` com `source='WHATSAPP'` a partir de `contacts.phone` normalizado.
- Estratégia de conflito:
  - registrar e pular conflitos para revisão manual.
- Não sobrescrever contatos automaticamente em conflito sem decisão humana.

## 6.3 Novos clientes (onboarding)
- No processo de ativação:
  - configurar canal no Chatwoot,
  - salvar config por organização,
  - validar webhook,
  - validar resolução de identidade e criação de deal.

---

## 7. Testes técnicos (unit/integration/e2e)

## 7.1 Unit tests
- Geração de chave canônica por canal.
- Resolução de identidade com e sem fallback.
- Detecção de ambiguidade de config de canal.

## 7.2 Integration tests
- Upsert idempotente em `messaging_contact_identities`.
- Criação/associação de contato com `source='INSTAGRAM'` e `external_id`.
- Movimentação de deal por `deal_id` com `ai_summary`.

## 7.3 E2E tests
- WhatsApp regressão (cliente existente).
- Instagram primeiro contato (sem histórico).
- Reentrada de mensagem Instagram (idempotência).
- Cliente com múltiplos canais ativos na mesma organização.
- Recuperação após falha de webhook/provider.

---

## 8. Critérios de aceite técnicos

1. Solução funciona para múltiplas organizações sem código por cliente.
2. Instagram DM cria/associa contato e deal de forma determinística.
3. Automações de stage usam `deal_id` no fluxo recomendado.
4. Chave de sessão/buffer é canônica e sem colisão cross-channel.
5. WhatsApp legado permanece estável (sem regressão funcional).
6. Configuração de canal não apresenta ambiguidade operacional.
7. Migrations e serviços são aditivos e compatíveis com sync de fork.
8. Testes críticos (unit/integration/e2e) aprovados antes de rollout amplo.

---

## Assumptions e defaults
- Escopo é multi-org agora (não Coronel-only).
- Implementação deve ser aditiva e fork-safe.
- Coronel será piloto, não exceção de código.
- Documento escrito para implementação direta pela equipe de engenharia.
