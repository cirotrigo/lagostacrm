import type { Metadata } from 'next';
import { getMenuProducts, groupByCategory } from '@/lib/public-menu';
import { PublicLayout } from '@/components/public/PublicLayout';
import { CardapioClient } from '@/components/public/CardapioClient';

export const revalidate = 60; // ISR: 1 minute

export const metadata: Metadata = {
  title: 'Cardápio — Empório Fonseca',
  description:
    'Cardápio digital do Empório Fonseca. Entradas, pratos principais, sobremesas, cafés especiais, drinks e muito mais. Monte seu pedido e envie pelo WhatsApp.',
};

export default async function CardapioPage() {
  const products = await getMenuProducts();
  const categories = groupByCategory(products);

  return (
    <PublicLayout>
      <div className="min-h-screen">
        {/* Page header */}
        <div className="text-center py-10 px-6">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#D4B85A]">
            Menu Digital
          </span>
          <h1 className="font-[family-name:var(--font-old-standard)] text-3xl sm:text-4xl font-bold text-[#4A4A50] mt-2">
            Nosso Cardápio
          </h1>
          <p className="text-sm text-[#4A4A50]/60 mt-2 max-w-md mx-auto">
            Escolha seus itens e envie o pedido pelo WhatsApp para retirada.
          </p>
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="h-px w-12 bg-[#D4B85A]/40" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#D4B85A]/60" />
            <div className="h-px w-12 bg-[#D4B85A]/40" />
          </div>
        </div>

        <CardapioClient categories={categories} />
      </div>
    </PublicLayout>
  );
}
