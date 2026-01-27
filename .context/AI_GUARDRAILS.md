# AI Guardrails — LagostaCRM & Clientes

Este documento define regras operacionais obrigatórias para assistentes de IA trabalhando neste repositório.

---

## Regra Zero (Obrigatória)

Antes de QUALQUER ação técnica (editar arquivos, sugerir comandos, planejar commits ou deploys), a IA DEVE:

1. Informar explicitamente a branch atual (`git branch --show-current`)
2. Confirmar que a ação é permitida para essa branch
3. **Parar e avisar** se estiver em `main`

> ⚠️ Esta regra tem precedência sobre todas as outras.

---

## Estrutura de Branches

| Branch | Propósito | Ambiente | Vercel |
|--------|-----------|----------|--------|
| `main` | Espelho do upstream (nossocrm) | **NÃO USAR** | ❌ Não faz deploy |
| `project/lagostacrm` | Desenvolvimento LagostaCRM | Produção LagostaCRM | lagostacrm.vercel.app |
| `client/jucaocrm` | Desenvolvimento SosPet/JucãoCRM | Produção SosPet | sospet-blue.vercel.app |

> **Nota**: JucãoCRM é o nome do conjunto de features. SosPet é o nome do produto/cliente.

---

## Desenvolvimento Local (Ambientes)

Cada cliente tem seu próprio banco de dados Supabase. Use o comando correto:

| Cliente | Banco | Comando Local | Arquivo .env |
|---------|-------|---------------|--------------|
| **SosPet** | `ernsckhyavrmfgcgjadn` | `npm run dev:sospet` | `.env.sospet` |
| **LagostaCRM** | `abddatrjqytwyusiblxy` | `npm run dev:lagosta` | `.env.lagostacrm` |

### Fluxo Completo de Trabalho

**Para SosPet:**
```bash
git checkout client/jucaocrm      # Branch correta
npm run dev:sospet                 # Banco SosPet
# ... desenvolve ...
git add <arquivos>
git commit -m "feat(jucaocrm): ..."
git push origin client/jucaocrm   # Deploy em sospet-blue.vercel.app
```

**Para LagostaCRM:**
```bash
git checkout project/lagostacrm   # Branch correta
npm run dev:lagosta               # Banco LagostaCRM
# ... desenvolve ...
git add <arquivos>
git commit -m "feat: ..."
git push origin project/lagostacrm # Deploy em lagostacrm.vercel.app
```

### Rodar ambos simultaneamente (portas diferentes)
```bash
npm run dev:sospet:3001   # http://localhost:3001
npm run dev:lagosta:3002  # http://localhost:3002
```

> ⚠️ **ATENÇÃO**: Os arquivos `.env.sospet` e `.env.lagostacrm` são APENAS para desenvolvimento local. Em produção, cada projeto Vercel tem suas próprias variáveis configuradas no painel.

---

## Regras Obrigatórias

### 1. NUNCA commitar em `main`
- A branch `main` é SOMENTE para sincronização com upstream
- Se estiver em `main` com alterações, mudar para a branch de trabalho apropriada

### 2. Verificar branch ANTES de qualquer commit
```bash
git branch --show-current
git status
```

### 3. Comandos proibidos (sem autorização explícita)
- `git reset --hard`
- `git push --force` / `git push -f`
- `git clean -f`
- `git checkout .` (descarta todas alterações)

### 4. Isolamento de Clientes
- **JucãoCRM** = `client/jucaocrm` (produção na Vercel para este cliente)
- **LagostaCRM** = `project/lagostacrm`
- **NUNCA misturar features de um cliente no outro**
- Features específicas de cliente ficam em `clients/<nome>/`

**Detecção de vazamento de escopo:**
Se a IA detectar que uma feature específica de cliente está sendo usada fora de `clients/<nome>/`, ela DEVE:
1. **Parar** a execução
2. **Avisar** sobre vazamento de escopo
3. **Propor alternativa** por extensão ou feature flag (`CLIENT_ID`)

### 5. Execução de comandos
- **Modo serial**: um comando por vez, mostrando output
- Aguardar confirmação antes de operações destrutivas

### 6. Padrão de Commits (Obrigatório)
- Todos os commits DEVEM seguir [Conventional Commits](https://www.conventionalcommits.org/):
  - `docs:` — Documentação
  - `feat:` — Nova funcionalidade
  - `fix:` — Correção de bug
  - `chore:` — Manutenção/tarefas gerais
  - `refactor:` — Refatoração de código
  - `test:` — Testes
  - `perf:` — Melhorias de performance
- **Commits genéricos são PROIBIDOS** (ex: "update", "wip", "fix stuff")

---

## Fluxo de Atualização do Upstream

Para atualizar do repositório original (nossocrm) sem quebrar os clientes:

```bash
# 1. Ir para main (apenas para sincronizar)
git checkout main
git fetch upstream
git merge upstream/main
git push origin main

# 2. Voltar para branch do cliente
git checkout client/jucaocrm  # ou project/lagostacrm

# 3. Incorporar atualizações
git merge main

# 4. Resolver conflitos se necessário e push
git push
```

---

## Upstream

- **Repositório upstream**: https://github.com/thaleslaray/nossocrm.git
- **Repositório origin**: https://github.com/cirotrigo/lagostacrm.git

---

## Deploy Awareness (Vercel)

Antes de qualquer `git push`, a IA DEVE:

1. **Avisar** se o push pode disparar deploy
2. **Informar** QUAL cliente/projeto será afetado
3. **Nunca assumir** produção sem confirmação explícita

| Branch | Impacto do Push | URL |
|--------|-----------------|-----|
| `main` | ❌ NÃO FAZ DEPLOY (apenas sync) | — |
| `client/jucaocrm` | ✅ Produção SosPet | sospet-blue.vercel.app |
| `project/lagostacrm` | ✅ Produção LagostaCRM | lagostacrm.vercel.app |
| `feature/*` | Preview deployment apenas | *.vercel.app |

> **Importante**: A branch `main` está configurada no "Ignored Build Step" da Vercel e NÃO dispara deploys.

---

## Referências

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Development Workflow](.context/docs/development-workflow.md)
