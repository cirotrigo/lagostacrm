/**
 * Client-side hook for dynamic branding
 *
 * Carrega branding do banco via API e faz cache com React Query.
 * Componentes que precisam de branding dinâmico podem usar este hook.
 *
 * @example
 * ```tsx
 * import { useBranding } from '@/lib/branding/useBranding';
 *
 * function Header() {
 *   const { brand, isLoading } = useBranding();
 *   return <h1>{brand.name}</h1>;
 * }
 * ```
 */

import { useQuery } from '@tanstack/react-query';
import { type BrandConfig, getBranding } from '../branding';

/**
 * Query key for branding data
 */
export const brandingQueryKey = ['branding'] as const;

/**
 * Fetches branding from the API
 */
async function fetchBranding(): Promise<BrandConfig> {
  const res = await fetch('/api/branding');
  if (!res.ok) {
    // Fallback to sync branding if API fails
    return getBranding();
  }
  return res.json();
}

/**
 * Hook to get dynamic branding from the database
 *
 * Returns cached branding immediately (staleTime: 10min) to avoid
 * layout shifts. The branding rarely changes, so aggressive caching is fine.
 *
 * During SSR/initial load, returns sync fallback from getBranding().
 */
export function useBranding(): {
  brand: BrandConfig;
  isLoading: boolean;
  isError: boolean;
} {
  const fallback = getBranding();

  const { data, isLoading, isError } = useQuery({
    queryKey: brandingQueryKey,
    queryFn: fetchBranding,
    staleTime: 10 * 60 * 1000, // 10 minutes - branding rarely changes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    // Use sync fallback as placeholder while loading
    placeholderData: fallback,
  });

  return {
    brand: data ?? fallback,
    isLoading,
    isError,
  };
}
