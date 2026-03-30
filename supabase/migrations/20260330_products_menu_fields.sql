-- Migration: Add digital menu fields to products table
-- Fields: category, image_url, sort_order, available, tags, featured

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category    TEXT,
  ADD COLUMN IF NOT EXISTS image_url   TEXT,
  ADD COLUMN IF NOT EXISTS sort_order  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS available   BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS tags        TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS featured    BOOLEAN DEFAULT false;

-- Index for menu queries (category grouping + ordering)
CREATE INDEX IF NOT EXISTS idx_products_category_sort
  ON public.products (organization_id, category, sort_order);

-- Index for featured items quick lookup
CREATE INDEX IF NOT EXISTS idx_products_featured
  ON public.products (organization_id, featured)
  WHERE featured = true AND active = true;
