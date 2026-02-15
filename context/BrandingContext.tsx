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
 * Converte hex para HSL
 */
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  // Remove # se presente
  hex = hex.replace(/^#/, '');

  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Converte HSL para hex
 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
  else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
  else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
  else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
  else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
  else if (h >= 300 && h < 360) { r = c; g = 0; b = x; }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Gera paleta de cores (50-900) a partir de uma cor base
 * A cor base será usada como 500/600
 */
function generateColorPalette(baseHex: string): Record<string, string> {
  const { h, s } = hexToHSL(baseHex);

  // Luminosidades aproximadas para cada nível (baseado nas paletas do Tailwind)
  const levels: Record<string, number> = {
    '50': 97,
    '100': 94,
    '200': 86,
    '300': 74,
    '400': 60,
    '500': 50,
    '600': 43,
    '700': 35,
    '800': 27,
    '900': 20,
  };

  const palette: Record<string, string> = {};

  for (const [level, lightness] of Object.entries(levels)) {
    // Ajustar saturação: mais saturado para tons médios, menos para extremos
    let adjustedS = s;
    if (lightness > 80) adjustedS = Math.max(s * 0.3, 10);
    else if (lightness > 60) adjustedS = Math.max(s * 0.7, 20);
    else if (lightness < 30) adjustedS = Math.max(s * 0.8, 30);

    palette[level] = hslToHex(h, adjustedS, lightness);
  }

  return palette;
}

/**
 * Aplica a paleta de cores como CSS custom properties no :root
 */
function applyColorPalette(palette: Record<string, string>) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  for (const [level, color] of Object.entries(palette)) {
    root.style.setProperty(`--color-primary-${level}`, color);
  }
}

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

  // Aplicar cor primária dinamicamente quando mudar
  useEffect(() => {
    if (brand.primaryColor && /^#[0-9A-Fa-f]{6}$/.test(brand.primaryColor)) {
      const palette = generateColorPalette(brand.primaryColor);
      applyColorPalette(palette);
    }
  }, [brand.primaryColor]);

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
