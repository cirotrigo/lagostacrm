## 2025-12-24 - Kanban menu re-render blast radius
**Learning:** Um estado/prop global (ex.: `openActivityMenuId`) passado para *todos* os cards de uma lista grande amplia o “blast radius” de re-render: um clique no menu pode re-renderizar N cards sem necessidade.
**Action:** Para listas grandes, preferir props derivadas por-item (`isMenuOpen`) + `React.memo` e callbacks estáveis (useCallback) para limitar re-renders a O(1) componentes quando o estado muda.
