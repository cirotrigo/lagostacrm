---
name: "Plano: CRM Mobile + Tablet"
overview: ""
todos: []
---

# Plano: CRM Mobile + Tablet

## Objetivo

Bottom nav no mobile, navigation rail no tablet, sheets no mobile e preferências por usuário (tela inicial e Inbox/Boards primeiro).

## Entregas

- Preferências por usuário persistidas em `user_settings` (reusar `default_route` + adicionar `mobile_primary_first`).
- Shell adaptativo: mobile=BottomNav, tablet=Rail, desktop=sidebar atual.
- Sheet system (FullscreenSheet) e DealSheet no mobile.
- SplitView no tablet (fase 2) começando por Inbox.

## Arquivos principais

- `components/Layout.tsx`
- `context/settings/SettingsContext.tsx`
- `lib/supabase/settings.ts`
- `features/settings/*`
- `components/ui/*` (Sheet)

## QA

Testar 390×844, 768×1024, 1024×768, 1280×800; sem overflow; teclado não cobre CTA.