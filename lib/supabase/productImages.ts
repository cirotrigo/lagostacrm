/**
 * Product Images Service
 * Upload and manage product images via Supabase Storage (public bucket).
 */
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'product-images';

function getStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  // Use raw supabase-js client for Storage (avoids SSR client quirks)
  return createClient(url, key);
}

export const productImagesService = {
  /**
   * Upload an image for a product. Returns the public URL.
   */
  async upload(productId: string, file: File): Promise<{ url: string | null; error: Error | null }> {
    const sb = getStorageClient();
    if (!sb) return { url: null, error: new Error('Supabase não configurado') };

    // Ensure user session is set (copy from SSR client)
    try {
      const { supabase } = await import('./client');
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await sb.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
        }
      }
    } catch {
      // Fallback: continue without session copy
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${productId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await sb.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type });

    if (uploadError) return { url: null, error: uploadError };

    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  },

  /**
   * Delete an image by its full public URL (extracts path from URL).
   */
  async deleteByUrl(publicUrl: string): Promise<{ error: Error | null }> {
    const sb = getStorageClient();
    if (!sb) return { error: new Error('Supabase não configurado') };

    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return { error: new Error('URL inválida') };

    const path = publicUrl.substring(idx + marker.length);
    const { error } = await sb.storage.from(BUCKET).remove([path]);
    return { error: error ?? null };
  },
};
