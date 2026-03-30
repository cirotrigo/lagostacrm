/**
 * @fileoverview Serviço Supabase para catálogo de produtos/serviços.
 *
 * Observação:
 * - O CRM é "adaptável": o catálogo é um acelerador (defaults).
 * - No deal, ainda permitimos itens personalizados (product_id pode ser NULL em deal_items).
 */

import { supabase } from './client';
import { Product } from '@/types';
import { sanitizeUUID } from './utils';

// =============================================================================
// Organization inference (client-side, RLS-safe)
// =============================================================================
let cachedOrgId: string | null = null;
let cachedOrgUserId: string | null = null;

async function getCurrentOrganizationId(): Promise<string | null> {
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  if (cachedOrgUserId === user.id && cachedOrgId) return cachedOrgId;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (error) return null;

  const orgId = sanitizeUUID((profile as any)?.organization_id);
  cachedOrgUserId = user.id;
  cachedOrgId = orgId;
  return orgId;
}

const SELECT_COLS = 'id, organization_id, name, description, price, sku, active, category, image_url, sort_order, available, tags, featured, created_at, updated_at, owner_id';

type DbProduct = {
  id: string;
  organization_id: string | null;
  name: string;
  description: string | null;
  price: number;
  sku: string | null;
  active: boolean | null;
  category: string | null;
  image_url: string | null;
  sort_order: number | null;
  available: boolean | null;
  tags: string[] | null;
  featured: boolean | null;
  created_at: string;
  updated_at: string;
  owner_id: string | null;
};

function transformProduct(db: DbProduct): Product {
  return {
    id: db.id,
    organizationId: db.organization_id || undefined,
    name: db.name,
    description: db.description || undefined,
    price: Number(db.price ?? 0),
    sku: db.sku || undefined,
    active: db.active ?? true,
    category: db.category || undefined,
    imageUrl: db.image_url || undefined,
    sortOrder: db.sort_order ?? 0,
    available: db.available ?? true,
    tags: db.tags ?? [],
    featured: db.featured ?? false,
  };
}

export type ProductCreateInput = {
  name: string;
  price: number;
  sku?: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  sortOrder?: number;
  available?: boolean;
  tags?: string[];
  featured?: boolean;
};

export type ProductUpdateInput = Partial<ProductCreateInput & { active: boolean }>;

export const productsService = {
  async getAll(): Promise<{ data: Product[]; error: Error | null }> {
    try {
      if (!supabase) return { data: [], error: new Error('Supabase não configurado') };

      const { data, error } = await supabase
        .from('products')
        .select(SELECT_COLS)
        .order('created_at', { ascending: false });

      if (error) return { data: [], error };

      const rows = (data || []) as DbProduct[];
      return { data: rows.map(transformProduct), error: null };
    } catch (e) {
      return { data: [], error: e as Error };
    }
  },

  async getActive(): Promise<{ data: Product[]; error: Error | null }> {
    try {
      if (!supabase) return { data: [], error: new Error('Supabase não configurado') };

      const { data, error } = await supabase
        .from('products')
        .select(SELECT_COLS)
        .eq('active', true)
        .order('sort_order', { ascending: true });

      if (error) return { data: [], error };

      const rows = (data || []) as DbProduct[];
      return { data: rows.map(transformProduct), error: null };
    } catch (e) {
      return { data: [], error: e as Error };
    }
  },

  async create(input: ProductCreateInput): Promise<{ data: Product | null; error: Error | null }> {
    try {
      if (!supabase) return { data: null, error: new Error('Supabase não configurado') };

      const { data: { user } } = await supabase.auth.getUser();
      const organizationId = await getCurrentOrganizationId();

      const { data, error } = await supabase
        .from('products')
        .insert({
          name: input.name,
          price: input.price,
          sku: input.sku || null,
          description: input.description || null,
          category: input.category || null,
          image_url: input.imageUrl || null,
          sort_order: input.sortOrder ?? 0,
          available: input.available ?? true,
          tags: input.tags ?? [],
          featured: input.featured ?? false,
          active: true,
          owner_id: sanitizeUUID(user?.id),
          organization_id: organizationId,
        })
        .select(SELECT_COLS)
        .single();

      if (error) return { data: null, error };
      return { data: transformProduct(data as DbProduct), error: null };
    } catch (e) {
      return { data: null, error: e as Error };
    }
  },

  async update(id: string, updates: ProductUpdateInput): Promise<{ error: Error | null }> {
    try {
      if (!supabase) return { error: new Error('Supabase não configurado') };

      const payload: Record<string, unknown> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.price !== undefined) payload.price = updates.price;
      if (updates.sku !== undefined) payload.sku = updates.sku || null;
      if (updates.description !== undefined) payload.description = updates.description || null;
      if (updates.category !== undefined) payload.category = updates.category || null;
      if (updates.imageUrl !== undefined) payload.image_url = updates.imageUrl || null;
      if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;
      if (updates.available !== undefined) payload.available = updates.available;
      if (updates.tags !== undefined) payload.tags = updates.tags;
      if (updates.featured !== undefined) payload.featured = updates.featured;
      if (updates.active !== undefined) payload.active = updates.active;
      payload.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', sanitizeUUID(id));

      return { error: error ?? null };
    } catch (e) {
      return { error: e as Error };
    }
  },

  async delete(id: string): Promise<{ error: Error | null }> {
    try {
      if (!supabase) return { error: new Error('Supabase não configurado') };
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', sanitizeUUID(id));

      return { error: error ?? null };
    } catch (e) {
      return { error: e as Error };
    }
  },
};
