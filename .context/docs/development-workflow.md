# Fluxo de Desenvolvimento - LagostaCRM

> **Guia completo do fluxo de trabalho para desenvolvimento no LagostaCRM.**

---

## Fluxo Visual

```
┌─────────────────────────────────────────────────────────────────────┐
│                        WORKFLOW DE BRANCHES                         │
└─────────────────────────────────────────────────────────────────────┘

[UPSTREAM]                    [ORIGIN]                    [LOCAL]
thaleslaray/nossocrm         cirotrigo/lagostacrm

     main ◄──── fetch/merge ────► main ◄──────────────── main
                                   │                       │
                                   │ (sync only)           │
                                   ▼                       ▼
                           project/lagostacrm ◄─── project/lagostacrm
                                   │                       │
                                   │                       │
                                   ▼                       ▼
                            feature/xxx ◄──────────── feature/xxx
```

---

## 1. Setup Inicial (Primeira Vez)

### Clonar o Fork
```bash
git clone https://github.com/cirotrigo/lagostacrm.git
cd lagostacrm
```

### Configurar Upstream
```bash
git remote add upstream https://github.com/thaleslaray/nossocrm.git
git remote -v
# Deve mostrar origin E upstream
```

### Verificar Branches
```bash
git branch -a
git checkout project/lagostacrm
```

---

## 2. Fluxo de Trabalho Diário

### Iniciar Trabalho
```bash
# Sempre verificar a branch atual
git branch --show-current
# Deve ser: project/lagostacrm ou feature/*

# Ver status
git status
```

### Para Nova Feature
```bash
# Partir da branch de desenvolvimento
git checkout project/lagostacrm
git pull origin project/lagostacrm

# Criar branch de feature
git checkout -b feature/nome-da-feature

# Trabalhar...
# Commitar...
# Push...

git push -u origin feature/nome-da-feature
```

### Para Fix Rápido
```bash
git checkout project/lagostacrm
git pull origin project/lagostacrm

# Fazer a correção diretamente ou criar branch fix/
git add <arquivos>
git commit -m "fix: descrição da correção"
git push
```

---

## 3. Sincronização com Upstream

### Quando Sincronizar?
- Periodicamente (semanal/mensal)
- Quando houver atualizações importantes no upstream
- Antes de começar uma feature grande

### Processo de Sync
```bash
# 1. Ir para main (ÚNICO momento permitido)
git checkout main

# 2. Buscar atualizações do upstream
git fetch upstream

# 3. Mesclar atualizações
git merge upstream/main

# 4. Enviar para origin
git push origin main

# 5. VOLTAR para branch de desenvolvimento
git checkout project/lagostacrm

# 6. Mesclar atualizações na branch de desenvolvimento
git merge main

# 7. Resolver conflitos se houver
# ... editar arquivos conflitantes ...
git add .
git commit -m "chore: merge upstream updates"

# 8. Push
git push origin project/lagostacrm
```

### Resolvendo Conflitos
```bash
# Ver arquivos com conflito
git status

# Editar cada arquivo e escolher:
# - Manter código do upstream
# - Manter nosso código
# - Combinar ambos

# Após resolver
git add <arquivo-resolvido>
git commit -m "chore: resolve merge conflicts from upstream"
```

---

## 4. Commits

### Antes de Commitar (Checklist)
- [ ] Estou na branch correta? (`git branch --show-current`)
- [ ] Não estou na main?
- [ ] Os arquivos corretos estão staged? (`git status`)
- [ ] Não há arquivos sensíveis? (.env, credentials)

### Formato de Commit
```bash
git commit -m "<tipo>: <descrição curta>"

# Exemplos:
git commit -m "feat: adiciona filtro por data no dashboard"
git commit -m "fix: corrige cálculo de total em deals"
git commit -m "docs: atualiza README com instruções de setup"
git commit -m "refactor: simplifica lógica de autenticação"
```

### Commits Atômicos
Um commit = uma unidade lógica de mudança

**BOM:**
```bash
git commit -m "feat: adiciona botão de exportar"
git commit -m "feat: implementa exportação para CSV"
git commit -m "feat: implementa exportação para PDF"
```

**RUIM:**
```bash
git commit -m "feat: adiciona exportação, corrige bug do header, atualiza deps"
```

---

## 5. Push e Deploy

### Antes do Push
```bash
# Verificar o que será enviado
git log origin/project/lagostacrm..HEAD --oneline

# Verificar branch
git branch --show-current
```

### Push
```bash
git push origin <branch-atual>

# Se for branch nova
git push -u origin <branch-nova>
```

### Cuidado com Deploy
- **Production Branch** = deploy automático em produção
- Outras branches = preview deployment
- Sempre verificar qual é a Production Branch no Vercel

---

## 6. Pull Requests (Opcional)

### Quando Usar PR?
- Features grandes
- Mudanças que precisam revisão
- Contribuições de outros desenvolvedores

### Criando PR
```bash
# Via GitHub CLI
gh pr create --base project/lagostacrm --head feature/minha-feature

# Ou via interface web do GitHub
```

---

## 7. Fluxos Especiais

### Hotfix em Produção
```bash
git checkout project/lagostacrm
git pull
git checkout -b hotfix/descricao-do-bug
# Fazer correção
git add .
git commit -m "fix: descrição da correção urgente"
git push -u origin hotfix/descricao-do-bug
# Mergear rapidamente
git checkout project/lagostacrm
git merge hotfix/descricao-do-bug
git push
```

### Revertendo Mudanças
```bash
# Reverter último commit (cria novo commit de reversão)
git revert HEAD

# Reverter commit específico
git revert <hash-do-commit>
```

### Descartando Mudanças Locais (COM CUIDADO)
```bash
# Descartar mudanças em arquivo específico
git checkout -- <arquivo>

# Descartar TUDO (PERIGOSO - requer autorização)
# git checkout .
```

---

## 8. Boas Práticas

### DO (Fazer)
- Commitar frequentemente
- Usar mensagens descritivas
- Verificar branch antes de commitar
- Manter branches atualizadas
- Resolver conflitos cuidadosamente

### DON'T (Não Fazer)
- Commitar na main
- Usar `--force` sem autorização
- Commitar arquivos sensíveis
- Fazer commits gigantes
- Ignorar conflitos de merge

---

## 9. Troubleshooting

### "Commitei na main sem querer"
```bash
# Copiar hash do commit
git log -1

# Voltar main ao estado do origin
git reset HEAD~1

# Mudar para branch correta
git checkout project/lagostacrm

# Aplicar mudanças
git cherry-pick <hash>
```

### "Conflito de merge"
```bash
# Ver arquivos em conflito
git status

# Abrir cada arquivo e procurar por:
# <<<<<<< HEAD
# (seu código)
# =======
# (código do outro branch)
# >>>>>>> branch-name

# Editar, escolher o código correto, remover marcadores
git add <arquivo>
git commit
```

### "Preciso desfazer último commit"
```bash
# Manter mudanças staged
git reset --soft HEAD~1

# Descartar mudanças completamente (CUIDADO)
git reset --hard HEAD~1  # Requer autorização
```
