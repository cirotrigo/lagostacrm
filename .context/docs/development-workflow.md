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
- Antes de confirmar o push, lembre-se que as alterações irão para produção
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

## Referências

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Branching Strategies](https://git-scm.com/book/en/v2/Git-Branching-Branching-Workflows)
- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel Deployment](https://vercel.com/docs)
