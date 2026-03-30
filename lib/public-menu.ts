/**
 * @fileoverview Data-fetching layer for the public menu pages.
 * Uses createStaticAdminClient() to query Supabase directly (no API key needed).
 * Results are cached via Next.js ISR (revalidate every 5 minutes).
 */

import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';

const ORG_ID = process.env.EMPORIO_ORGANIZATION_ID || '0ba344eb-8c40-403e-93e0-f6171e1cf06e';

export const CATEGORY_ORDER = [
  'Café da Manhã — Pratos',
  'Café da Manhã — Toasts e Sanduíches',
  'Café da Manhã — Adicionais',
  'Entradas',
  'Principais',
  'Sobremesas',
  'Métodos Filtrados',
  'Bebidas Quentes',
  'Bebidas Geladas',
  'Bebidas Alcoólicas',
  'Bebidas Sem Álcool',
] as const;

export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  sort_order: number;
  available: boolean;
  tags: string[];
  featured: boolean;
};

export type MenuCategory = {
  name: string;
  slug: string;
  items: MenuItem[];
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function transformRow(row: any): MenuItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    price: Number(row.price ?? 0),
    category: row.category ?? 'Outros',
    image_url: row.image_url ?? null,
    sort_order: row.sort_order ?? 0,
    available: row.available ?? true,
    tags: row.tags ?? [],
    featured: row.featured ?? false,
  };
}

export async function getMenuProducts(): Promise<MenuItem[]> {
  const sb = createStaticAdminClient();
  const { data, error } = await sb
    .from('products')
    .select('id, name, description, price, category, image_url, sort_order, available, tags, featured')
    .eq('organization_id', ORG_ID)
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('[public-menu] Error fetching products:', error.message);
    return [];
  }

  return (data || []).map(transformRow);
}

export async function getFeaturedProducts(): Promise<MenuItem[]> {
  const sb = createStaticAdminClient();
  const { data, error } = await sb
    .from('products')
    .select('id, name, description, price, category, image_url, sort_order, available, tags, featured')
    .eq('organization_id', ORG_ID)
    .eq('active', true)
    .eq('available', true)
    .eq('featured', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[public-menu] Error fetching featured:', error.message);
    return [];
  }

  return (data || []).map(transformRow);
}

export function groupByCategory(items: MenuItem[]): MenuCategory[] {
  const map = new Map<string, MenuItem[]>();

  for (const item of items) {
    const cat = item.category;
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(item);
  }

  // Sort categories by predefined order
  const ordered: MenuCategory[] = [];
  for (const catName of CATEGORY_ORDER) {
    const items = map.get(catName);
    if (items && items.length > 0) {
      ordered.push({ name: catName, slug: slugify(catName), items });
      map.delete(catName);
    }
  }

  // Append any remaining categories not in the predefined order
  for (const [catName, items] of map) {
    if (items.length > 0) {
      ordered.push({ name: catName, slug: slugify(catName), items });
    }
  }

  return ordered;
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/** WhatsApp number placeholder — will be configured later */
export const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_EMPORIO_WHATSAPP || '';
