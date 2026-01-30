# AI Guardrails - LagostaCRM

> **Este arquivo define as regras operacionais obrigatórias para qualquer AI assistant trabalhando neste repositório.**
> Deve ser lido e seguido ANTES de qualquer ação técnica.

---

## 1. Regras de Branch (OBRIGATÓRIO)

### Branch Principal (main)
- **NUNCA commitar diretamente na branch `main`**
- A branch `main` é espelho do upstream: `https://github.com/thaleslaray/nossocrm.git`
- Commits diretos em `main` causam conflitos com o repositório original

### Branches de Trabalho Permitidas
| Branch | Uso |
|--------|-----|
| `project/lagostacrm` | Branch principal de desenvolvimento do LagostaCRM |
| `feature/<topic>` | Novas funcionalidades |
| `fix/<topic>` | Correções de bugs |
| `hotfix/<topic>` | Correções urgentes |
| `client/<nome>` | Personalizações específicas de clientes |

### Verificação Obrigatória (antes de qualquer commit)
```bash
git branch --show-current
git status
```

### Auto-correção de Branch
Se detectar alterações na branch `main`:
1. **NÃO commitar**
2. Mudar para `project/lagostacrm` ou criar `feature/<topic>`
3. Só então prosseguir com o commit

---

## 2. Padrão de Commits (Conventional Commits)

Formato obrigatório: `<tipo>: <descrição curta>`

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

### Regras Adicionais
- Commits pequenos e atômicos
- Uma unidade lógica de mudança por commit
- Sempre perguntar sobre arquivos untracked antes de incluí-los
- Verificar que não há arquivos sensíveis (.env, credenciais, etc.)

---

## 3. Comandos Proibidos (sem autorização explícita)

Os seguintes comandos **NÃO podem ser executados** a menos que o usuário solicite explicitamente:

```bash
# PROIBIDOS
git reset --hard
git push --force
git push -f
git clean -f
git checkout .          # descarta todas as alterações
git restore .           # descarta todas as alterações
```

### Por quê?
Estes comandos podem causar **perda irreversível de trabalho**.

---

## 4. Fluxo de Commit Obrigatório

### Antes do Commit
1. `git branch --show-current` - confirmar branch
2. `git status` - ver alterações
3. Verificar se há arquivos untracked não desejados
4. Verificar se não há arquivos sensíveis

### Durante o Commit
```bash
git add <arquivos-específicos>   # preferir arquivos específicos
git commit -m "<tipo>: <descrição>"
```

### Após o Commit
```bash
git push
git status
git log --oneline -n 5
```

---

## 5. Deploy e Vercel

### Configuração Atual
```
Production Branch: project/lagostacrm
```

### Comportamento de Deploy
| Branch | Resultado do Push |
|--------|------------------|
| `project/lagostacrm` | **Deploy em PRODUÇÃO** |
| `feature/*`, `fix/*`, `hotfix/*` | Preview deployment |
| `main` | Preview deployment (não usar para deploy) |

### Aviso Obrigatório
Antes de cada `git push` em `project/lagostacrm`:
- **CONFIRMAR** que as mudanças estão prontas para produção
- Avisar o usuário: "Push nesta branch fará deploy em produção"

### Por que `project/lagostacrm` é a Production Branch?
- Permite deploy das customizações independente do upstream
- A branch `main` fica reservada apenas para sync
- Controle total sobre quando as mudanças vão para produção

---

## 6. Comportamento do AI Assistant

### Ao Iniciar Qualquer Tarefa Técnica
O AI **DEVE**:
1. Ler este arquivo (`.context/AI_GUARDRAILS.md`)
2. Confirmar a branch atual
3. Verificar se a ação solicitada é permitida
4. Informar explicitamente se está seguindo as regras

### Formato de Confirmação
```
✅ Guardrails: lido e ativo
📍 Branch atual: <nome-da-branch>
✓ Ação permitida: <sim/não>
```

### Se uma Ação Violar as Regras
O AI **DEVE**:
1. **NÃO executar** a ação
2. Explicar claramente o conflito
3. Propor a alternativa correta

### Persistência
Este comportamento deve ser mantido durante **TODA a conversa**, inclusive:
- Após respostas longas
- Após erros
- Após mudanças de assunto
- Em novas sessões

---

## 7. Sincronização com Upstream

### Configuração Inicial (uma vez)
```bash
git remote add upstream https://github.com/thaleslaray/nossocrm.git
```

### Rotina de Sync (única forma de tocar em main)
```bash
git checkout main
git fetch upstream
git merge upstream/main
git push origin main
git checkout project/lagostacrm
git merge main
git push
```

### Observações
- Esta é a **ÚNICA** situação onde `main` é tocada
- Resolver conflitos se aparecerem
- Voltar imediatamente para branch de trabalho após sync

---

## 8. Checklist de Verificação

Antes de qualquer operação git:

- [ ] Branch atual é `project/lagostacrm` ou `feature/*` (não `main`)
- [ ] Arquivos sensíveis não estão incluídos
- [ ] Mensagem de commit segue padrão conventional
- [ ] Nenhum comando proibido será executado
- [ ] Usuário foi avisado sobre deploy (se push)

---

## 9. Referência Rápida

### Permitido
- Commits em `project/lagostacrm`
- Commits em `feature/*`, `fix/*`, `hotfix/*`, `client/*`
- Push para remote (com aviso de deploy)
- Sync de upstream (seguindo rotina específica)

### Proibido (sem autorização)
- Commits em `main`
- `git reset --hard`
- `git push --force`
- `git clean -f`
- `git checkout .` / `git restore .`

### Lembrete de Deploy
- Push em `project/lagostacrm` = **Deploy em Produção**
- Sempre avisar o usuário antes do push

---

## Documentação Relacionada

- [Project Context](.context/PROJECT_CONTEXT.md) - Contexto e arquitetura do projeto
- [Development Workflow](.context/docs/development-workflow.md) - Fluxo completo de desenvolvimento
- [Conventional Commits](https://www.conventionalcommits.org/)
