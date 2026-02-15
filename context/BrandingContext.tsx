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
 * Atualiza o título do documento (aba do navegador)
 */
function updateDocumentTitle(brandName: string) {
  if (typeof document === 'undefined') return;
  document.title = brandName;
}

/**
 * Gera um favicon SVG dinâmico com a cor do branding e a inicial do nome
 */
function generateFaviconSvg(primaryColor: string, initial: string): string {
  // Gerar cor mais escura para o gradiente
  const { h, s, l } = hexToHSL(primaryColor);
  const darkerColor = hslToHex(h, s, Math.max(l - 10, 20));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${primaryColor}"/>
      <stop offset="1" stop-color="${darkerColor}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="120" fill="url(#g)"/>
  <text x="256" y="340" text-anchor="middle" font-family="system-ui, sans-serif" font-size="280" font-weight="bold" fill="white">${initial}</text>
</svg>`;

  return svg;
}

/**
 * Atualiza o favicon do documento com um SVG dinâmico
 */
function updateFavicon(primaryColor: string, initial: string) {
  if (typeof document === 'undefined') return;

  const svg = generateFaviconSvg(primaryColor, initial);
  const dataUri = `data:image/svg+xml,${encodeURIComponent(svg)}`;

  // Remover favicons existentes
  const existingIcons = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
  existingIcons.forEach((icon) => icon.remove());

  // Criar novo favicon
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/svg+xml';
  link.href = dataUri;
  document.head.appendChild(link);

  // Também criar um para apple-touch-icon (alguns navegadores mobile)
  const appleLink = document.createElement('link');
  appleLink.rel = 'apple-touch-icon';
  appleLink.href = dataUri;
  document.head.appendChild(appleLink);
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

  // Atualizar título do documento quando o nome mudar
  useEffect(() => {
    if (brand.name) {
      updateDocumentTitle(brand.name);
    }
  }, [brand.name]);

  // Atualizar favicon quando a cor ou inicial mudarem
  useEffect(() => {
    const color = brand.primaryColor || '#22c55e'; // fallback verde
    const initial = brand.initial || brand.name?.[0]?.toUpperCase() || 'N';

    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
      updateFavicon(color, initial);
    }
  }, [brand.primaryColor, brand.initial, brand.name]);

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
