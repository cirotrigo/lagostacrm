'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { BrandConfig } from '@/lib/branding';
import { getBranding } from '@/lib/branding';

interface BrandingContextType {
  brand: BrandConfig;
  isLoaded: boolean;
}

const BrandingContext = createContext<BrandingContextType>({
  brand: getBranding(),
  isLoaded: false,
});

/**
 * Provider que carrega branding do banco uma única vez e distribui via Context.
 * Renderiza imediatamente com fallback do CLIENT_ID (sem flash/loading).
 * Atualiza quando os dados do banco chegam.
 */
export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrand] = useState<BrandConfig>(getBranding);
  const [isLoaded, setIsLoaded] = useState(false);

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
        // Silencioso — mantém fallback do CLIENT_ID
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <BrandingContext.Provider value={{ brand, isLoaded }}>
      {children}
    </BrandingContext.Provider>
  );
}

/**
 * Hook para consumir branding dinâmico.
 * Retorna o BrandConfig do banco (ou fallback do CLIENT_ID enquanto carrega).
 *
 * @example
 * ```tsx
 * const { brand } = useBrandingContext();
 * return <h1>{brand.name}</h1>;
 * ```
 */
export function useBrandingContext(): BrandingContextType {
  return useContext(BrandingContext);
}
