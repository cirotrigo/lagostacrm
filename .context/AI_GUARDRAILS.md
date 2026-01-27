# AI Guardrails — LagostaCRM & Clientes

Este documento define regras operacionais obrigatórias para assistentes de IA trabalhando neste repositório.

---

## Estrutura de Branches

| Branch | Propósito | Ambiente |
|--------|-----------|----------|
| `main` | Espelho do upstream (nossocrm) | **NÃO USAR PARA DESENVOLVIMENTO** |
| `project/lagostacrm` | Desenvolvimento LagostaCRM | Preview/Produção LagostaCRM |
| `client/jucaocrm` | Desenvolvimento JucãoCRM | Preview/Produção JucãoCRM |

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

### 5. Execução de comandos
- **Modo serial**: um comando por vez, mostrando output
- Aguardar confirmação antes de operações destrutivas

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

## Referências

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Development Workflow](.context/docs/development-workflow.md)
