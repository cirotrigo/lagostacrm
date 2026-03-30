import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getClientId } from '@/lib/client';
import { getClientPublicPage, getClientConfigById } from '@/clients';
import { getFeaturedProducts } from '@/lib/public-menu';

import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const clientId = getClientId();
  const config = getClientConfigById(clientId);
  return {
    title: config.metadata.title,
    description: config.metadata.description,
  };
}

export default async function RootPage() {
  // If user is authenticated, redirect to dashboard
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      redirect('/dashboard');
    }
  } catch {
    // Not authenticated — show public page
  }

  const clientId = getClientId();
  const PublicPage = await getClientPublicPage(clientId);

  // No custom landing → redirect to login
  if (!PublicPage) {
    redirect('/login');
  }

  const featured = await getFeaturedProducts();

  return <PublicPage featured={featured} />;
}
