import { useState, useEffect } from 'react';
import type { BrandConfig } from '@/lib/branding';
import { getBranding } from '@/lib/branding';

/**
 * Hook para consumir branding dinâmico no client-side.
 *
 * Fluxo:
 * 1. Renderiza imediatamente com o fallback do CLIENT_ID (sem flash)
 * 2. Busca branding do banco via /api/branding em background
 * 3. Atualiza se os dados do banco forem diferentes
 *
 * @example
 * ```tsx
 * const brand = useBranding();
 * return <h1>{brand.name}</h1>; // "CRM Coronel" ou nome do banco
 * ```
 */
export function useBranding(): BrandConfig {
  const [brand, setBrand] = useState<BrandConfig>(getBranding);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/branding', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch branding');
        return res.json();
      })
      .then((data: BrandConfig) => {
        if (!cancelled && data.name) {
          setBrand(data);
        }
      })
      .catch(() => {
        // Silencioso — mantém fallback
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return brand;
}
