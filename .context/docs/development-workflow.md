---
type: doc
name: development-workflow
description: Day-to-day engineering processes, branching, and contribution guidelines
category: workflow
generated: 2026-01-25
status: filled
scaffoldVersion: "2.0.0"
---

# Development Workflow - LagostaCRM

Este documento define o fluxo de trabalho de desenvolvimento para o projeto LagostaCRM, incluindo estratégia de branches, regras de commit e processos de contribuição.

## Estratégia de Branches

### Branch Principal (main)
- **NUNCA faça commits diretamente na branch `main`**
- A branch `main` é um espelho do upstream: `https://github.com/thaleslaray/nossocrm.git`
- Qualquer alteração direta em `main` pode causar conflitos com o repositório original

### Branches de Trabalho
- **`project/lagostacrm`**: Branch principal de desenvolvimento para este projeto
- **`feature/<topic>`**: Para novas funcionalidades específicas
- **`fix/<topic>`**: Para correções de bugs
- **`hotfix/<topic>`**: Para correções urgentes em produção

---

## REGRAS FIXAS DE COMMIT (Obrigatórias)

### 1. Verificação de Branch (SEMPRE executar antes de qualquer commit)
```bash
git status
git branch --show-current
```

### 2. Nunca Commitar em Main
- Se estiver na branch `main` com alterações, **automaticamente**:
  1. Mudar para `project/lagostacrm`, OU
  2. Criar uma nova branch `feature/<topic>` baseada no contexto das mudanças

### 3. Padrão de Mensagens de Commit (Conventional Commits)
Use sempre o formato: `<tipo>: <descrição curta>`

| Tipo | Uso |
|------|-----|
| `docs:` | Documentação |
| `feat:` | Nova funcionalidade |
| `fix:` | Correção de bug |
| `chore:` | Manutenção/tarefas gerais |
| `refactor:` | Refatoração de código |
| `test:` | Testes |
| `style:` | Formatação (sem mudança de lógica) |
| `perf:` | Melhorias de performance |

### 4. Commits Pequenos e Atômicos
- Fazer commits pequenos e focados
- Cada commit deve representar uma unidade lógica de mudança
- Facilita revisão e rollback quando necessário

### 5. Arquivos Não Rastreados
- **Sempre perguntar** sobre arquivos untracked antes de incluí-los no commit
- Verificar se não há arquivos sensíveis (.env, credenciais, etc.)

---

## Fluxo Padrão de Commit

### Passo a Passo Obrigatório:

```bash
# 1. Verificar branch atual
git branch --show-current
git status

# 2. Se estiver em main, mudar para branch de trabalho
git checkout project/lagostacrm
# ou criar nova feature branch
git checkout -b feature/<nome-da-feature>

# 3. Adicionar arquivos (interativo para revisar)
git add -p
# ou para arquivos específicos
git add <arquivo1> <arquivo2>

# 4. Commit com mensagem padrão
git commit -m "<tipo>: <descrição>"

# 5. Push para remote
git push

# 6. Verificar resultado
git status
git log --oneline -n 5
```

---

## Deploy e Produção

### ⚠️ Aviso sobre Vercel
- **Todo push dispara um deploy automático no Vercel**
- Antes de dar push, confira a branch: pushes na Production Branch afetam produção; pushes em outras branches geram Preview Deployments.
- Para branches diferentes de `main`, o Vercel cria um preview deployment

### Verificação Pós-Push
Após cada push, verificar:
1. Status do deploy no Vercel
2. Logs de build para erros
3. Funcionamento da aplicação em preview/produção

---

## Comandos Proibidos (sem autorização explícita)

Os seguintes comandos **NÃO devem ser executados** a menos que explicitamente solicitados:

- `git reset --hard`
- `git push --force` / `git push -f`
- `git clean -f`
- `git checkout .` (descarta todas as alterações)

Estes comandos podem causar perda de trabalho irreversível.

---

## Estrutura do Projeto

```
lagostacrm/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   ├── (auth)/            # Rotas autenticadas
│   └── ...
├── components/            # Componentes React
├── lib/                   # Utilitários e configurações
├── hooks/                 # Custom React hooks
├── types/                 # Definições TypeScript
├── tests/                 # Testes (Vitest)
└── .context/              # Documentação AI Context
```

---

## Checklist de Contribuição

Antes de submeter qualquer mudança:

- [ ] Verificar que está na branch correta (não `main`)
- [ ] Rodar testes localmente: `npm run test`
- [ ] Verificar tipos: `npm run type-check`
- [ ] Verificar lint: `npm run lint`
- [ ] Commits seguem padrão conventional commits
- [ ] Código não contém credenciais ou dados sensíveis
- [ ] Verificar arquivos untracked antes de adicionar

---

## Vercel: Production vs Preview Deployments

A Vercel faz deploy automático para qualquer push no repositório, porém com comportamentos distintos:

| Tipo de Push | Resultado |
|--------------|-----------|
| Push na **Production Branch** | **Production Deployment** (site principal) |
| Push em outras branches | **Preview Deployment** (URL temporária) |

### Como verificar a Production Branch

1. Acesse o projeto na Vercel
2. Vá em **Settings** > **Git** > **Production Branch**
3. Verifique qual branch está configurada

> **Production Branch atual**: _(confirmar em Settings > Git > Production Branch)_

### Importante
- Preview deployments recebem URLs únicas (ex: `projeto-abc123.vercel.app`)
- Apenas a Production Branch afeta o domínio principal
- Cada push gera um novo deployment (mesmo em preview)

---

## Deploy Hooks (Vercel)

### O que são Deploy Hooks?

Deploy Hooks são URLs únicas que permitem disparar um deploy manualmente ou via automação, sem precisar fazer push no repositório.

### Características
- Cada hook é vinculado a uma **branch específica**
- Disparo via requisição HTTP POST para a URL do hook
- Útil para integrações com CMS, CI/CD externo ou releases manuais

### Status neste projeto
- **Atualmente não utilizamos deploy hooks**
- Deploys são feitos automaticamente via push no repositório

### Quando faria sentido usar
- Release manual controlado (ex: deploy em horário específico)
- Integração com ferramentas externas (CMS headless, pipelines customizados)
- Automação de deploy sem alterar código (ex: atualização de conteúdo)

### Como criar (se necessário)
1. Acesse o projeto na Vercel
2. Vá em **Settings** > **Git** > **Deploy Hooks**
3. Adicione um nome e selecione a branch
4. Use a URL gerada para disparar deploys

### Referência
- [Vercel Deploy Hooks](https://vercel.com/docs/deployments/deploy-hooks)

---

## Sync Upstream (nossocrm) — Rotina de Atualização

Para manter o projeto sincronizado com o repositório original (`nossocrm`), execute periodicamente:

```bash
# 1. Ir para main (apenas para sincronizar)
git checkout main

# 2. Buscar atualizações do upstream
git fetch upstream

# 3. Merge das atualizações
git merge upstream/main

# 4. Push para origin (seu fork)
git push origin main

# 5. Voltar para branch de trabalho
git checkout project/lagostacrm

# 6. Incorporar atualizações da main
git merge main

# 7. Push da branch de trabalho
git push
```

### Observações
- **Resolver conflitos** se aparecerem durante o merge
- **NUNCA commitar diretamente em main** — usar apenas para sincronização
- Configurar upstream (se ainda não estiver):
  ```bash
  git remote add upstream https://github.com/thaleslaray/nossocrm.git
  ```

---

## Release Flow (Como Publicar em Produção)

### Fluxo Recomendado

```
feature/* ou project/lagostacrm  ──►  PR para main  ──►  Merge  ──►  Deploy Produção
```

1. **Desenvolvimento**: Trabalhar em `project/lagostacrm` ou `feature/*`
2. **Pull Request**: Abrir PR para `main` quando estiver pronto para publicar
3. **Review**: Revisar código, garantir que CI passou
4. **Merge**: Merge na `main` dispara deploy em produção (se `main` for Production Branch)

### Checklist Antes do Merge

```bash
# Verificar build
npm run build

# Verificar lint
npm run lint

# Rodar testes
npm run test

# Verificar tipos (se disponível)
npm run type-check
```

- [ ] Build passa sem erros
- [ ] Lint sem warnings críticos
- [ ] Testes passando
- [ ] PR revisado e aprovado
- [ ] Sem arquivos sensíveis no diff

---

## Proteções Recomendadas

### GitHub Branch Protection (Recomendado)

Configurar proteção para a branch `main`:

1. **Settings** > **Branches** > **Add rule**
2. Branch name pattern: `main`
3. Habilitar:
   - [x] Require a pull request before merging
   - [x] Require approvals (1+)
   - [x] Require status checks to pass
   - [x] Require branches to be up to date

### Vercel Deployment Protection (Opcional)

Para ambientes de produção críticos:

1. **Project Settings** > **Deployment Protection**
2. Habilitar **Vercel Authentication** para previews
3. Configurar **Password Protection** se necessário

---

## Referências

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Branching Strategies](https://git-scm.com/book/en/v2/Git-Branching-Branching-Workflows)
- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel Deployment](https://vercel.com/docs)
- [Vercel Git Configuration](https://vercel.com/docs/deployments/git)
- [Vercel Production Deployments](https://vercel.com/docs/deployments/environments#production)
- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Vercel Deployment Protection](https://vercel.com/docs/security/deployment-protection)
