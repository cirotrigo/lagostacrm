import type { MetadataRoute } from 'next';
import { getBranding } from '@/lib/branding';

export default function manifest(): MetadataRoute.Manifest {
  const brand = getBranding();
  return {
    name: brand.name,
    short_name: brand.shortName,
    description: brand.description,
    start_url: '/boards',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0ea5e9',
    icons: [
      // SVG icons keep the repo text-only. If you need iOS splash/touch icons later,
      // add PNGs in a follow-up.
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/icons/maskable.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}

