# Configuração de Tokens WPPConnect

## O Problema

Tokens bcrypt gerados pelo WPPConnect contêm caracteres `$` que são interpretados como referências a variáveis de ambiente em diferentes plataformas:

```
$2b$10$3wEAbRv7e15DaDjOpBW82.3BFVkekQmNRXJeu6NV4ekVhlK4RIn22
```

Neste token:
- `$2b` → interpretado como variável `2b` (undefined)
- `$10` → interpretado como variável `10` (undefined)
- `$3wEAbRv7e15DaDjOpBW82` → interpretado como variável (undefined)

**Resultado sem escape:** O token é corrompido e a autenticação com WPPConnect falha (401 Unauthorized).

---

## Configuração por Ambiente

### 1. Ambiente Local (`.env.local`)

No Next.js local, use `\$` para escapar cada `$`:

```env
# ✅ CORRETO - Local (.env.local)
WPPCONNECT_TOKEN=\$2b\$10\$3wEAbRv7e15DaDjOpBW82.3BFVkekQmNRXJeu6NV4ekVhlK4RIn22

# ❌ INCORRETO - Será interpretado como variáveis
WPPCONNECT_TOKEN=$2b$10$3wEAbRv7e15DaDjOpBW82.3BFVkekQmNRXJeu6NV4ekVhlK4RIn22

# ❌ INCORRETO - Aspas simples NÃO funcionam no Next.js
WPPCONNECT_TOKEN='$2b$10$3wEAbRv7e15DaDjOpBW82.3BFVkekQmNRXJeu6NV4ekVhlK4RIn22'
```

### 2. Vercel (Environment Variables)

Na Vercel, use o token **sem escape** - cole diretamente como está:

```
# ✅ CORRETO - Vercel (sem escape!)
$2b$10$3wEAbRv7e15DaDjOpBW82.3BFVkekQmNRXJeu6NV4ekVhlK4RIn22
```

> **Nota:** A Vercel NÃO interpola variáveis dentro de Environment Variables configuradas via Dashboard. O valor é armazenado literalmente.

---

## Tokens Atuais dos Clientes

### Coronel Picanha (Produção)

| Campo | Valor |
|-------|-------|
| **Session Name** | `lagostacrm` |
| **Token Original** | `$2b$10$8_IrVGbLfQLNpj6dExU1vesxA_MRbYw_QR_OCWcsxXtJU2zRU47Ee` |
| **Token para .env.local** | `\$2b\$10\$8_IrVGbLfQLNpj6dExU1vesxA_MRbYw_QR_OCWcsxXtJU2zRU47Ee` |
| **Token para Vercel** | `$2b$10$8_IrVGbLfQLNpj6dExU1vesxA_MRbYw_QR_OCWcsxXtJU2zRU47Ee` (sem escape) |

### Lagosta Criativa (Desenvolvimento)

| Campo | Valor |
|-------|-------|
| **Session Name** | `lagostacriativa` |
| **Token Original** | `$2b$10$3wEAbRv7e15DaDjOpBW82.3BFVkekQmNRXJeu6NV4ekVhlK4RIn22` |
| **Token para .env.local** | `\$2b\$10\$3wEAbRv7e15DaDjOpBW82.3BFVkekQmNRXJeu6NV4ekVhlK4RIn22` |
| **Token para Vercel** | `$2b$10$3wEAbRv7e15DaDjOpBW82.3BFVkekQmNRXJeu6NV4ekVhlK4RIn22` (sem escape) |

---

## Configuração na Vercel - Passo a Passo

### Para Coronel Picanha (coronelpicanhacrm.vercel.app)

1. Acesse: https://vercel.com/dashboard → Projeto Coronel → Settings → Environment Variables
2. Configure as seguintes variáveis:

| Variável | Valor |
|----------|-------|
| `WPPCONNECT_HOST` | `https://wppconnect.lagostacriativa.com.br` |
| `WPPCONNECT_SECRET_KEY` | `LagostaWPP2024SecretKey32chars!!` |
| `WPPCONNECT_SESSION_NAME` | `lagostacrm` |
| `WPPCONNECT_TOKEN` | `$2b$10$8_IrVGbLfQLNpj6dExU1vesxA_MRbYw_QR_OCWcsxXtJU2zRU47Ee` |

3. Clique em "Save" e faça um novo deploy (Deployments → Redeploy)

### Para Lagosta Criativa (se houver deploy futuro)

| Variável | Valor |
|----------|-------|
| `WPPCONNECT_HOST` | `https://wppconnect.lagostacriativa.com.br` |
| `WPPCONNECT_SECRET_KEY` | `LagostaWPP2024SecretKey32chars!!` |
| `WPPCONNECT_SESSION_NAME` | `lagostacriativa` |
| `WPPCONNECT_TOKEN` | `$2b$10$3wEAbRv7e15DaDjOpBW82.3BFVkekQmNRXJeu6NV4ekVhlK4RIn22` |

---

## Verificação

### Como saber se o token está correto?

O token bcrypt deve ter **exatamente 60 caracteres** e começar com `$2b$10$`.

Se nos logs você ver:
- `tokenLength: 60` → ✅ Correto
- `tokenPrefix: "$2b$10$..."` → ✅ Correto
- `tokenLength: 32` ou menos → ❌ Token corrompido, verifique o escape

### Teste via curl

```bash
# Substitua pelo token correto (com aspas simples no bash)
TOKEN='$2b$10$8_IrVGbLfQLNpj6dExU1vesxA_MRbYw_QR_OCWcsxXtJU2zRU47Ee'
curl -s "https://wppconnect.lagostacriativa.com.br/api/lagostacrm/status-session" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Resumo

| Ambiente | Escape do `$` | Exemplo |
|----------|---------------|---------|
| **Local (.env.local)** | `\$` | `\$2b\$10\$...` |
| **Vercel** | Nenhum | `$2b$10$...` (cole direto) |
| Bash (aspas simples) | Nenhum | `'$2b$10$...'` |
| Bash (aspas duplas) | `\$` | `"\$2b\$10\$..."` |

---

*Documentado em: 2026-02-18*
*Contexto: Configuração multi-tenant WPPConnect para LagostaCRM*
