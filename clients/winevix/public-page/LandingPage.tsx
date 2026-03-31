'use client';

import { PublicLayout } from '@/components/public/PublicLayout';
import { HeroSection } from '@/components/public/HeroSection';
import { AboutSection } from '@/components/public/AboutSection';
import { FeaturedSection } from '@/components/public/FeaturedSection';
import { MenuCTASection } from '@/components/public/MenuCTASection';
import { LocationSection } from '@/components/public/LocationSection';

interface LandingPageProps {
  featured?: any[];
}

export default function LandingPage({ featured = [] }: LandingPageProps) {
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
