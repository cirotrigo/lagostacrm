import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PublicLayout } from '@/components/public/PublicLayout';
import { HeroSection } from '@/components/public/HeroSection';
import { AboutSection } from '@/components/public/AboutSection';
import { FeaturedSection } from '@/components/public/FeaturedSection';
import { MenuCTASection } from '@/components/public/MenuCTASection';
import { LocationSection } from '@/components/public/LocationSection';
import { getFeaturedProducts } from '@/lib/public-menu';

import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Empório Fonseca — Gastronomia Franco-Italiana em Vitória – ES',
  description:
    'Restaurante de gastronomia franco-italiana em Vitória – ES. Ingredientes selecionados, receitas autorais e cafés especiais para uma experiência única.',
};

export default async function RootPage() {
  // If user is authenticated, redirect to dashboard (preserve CRM behavior)
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      redirect('/dashboard');
    }
  } catch {
    // Not authenticated — show public landing page
  }

  const featured = await getFeaturedProducts();

  return (
    <PublicLayout>
      <HeroSection />
      <AboutSection />
      <FeaturedSection items={featured} />
      <MenuCTASection />
      <LocationSection />
    </PublicLayout>
  );
}
