import Link from 'next/link';
import { Star } from 'lucide-react';
import { type MenuItem, formatBRL } from '@/lib/public-menu';

export function FeaturedSection({ items }: { items: MenuItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="py-20 px-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#D4B85A]">
            Seleção especial
          </span>
          <h2 className="font-[family-name:var(--font-old-standard)] text-3xl sm:text-4xl font-bold text-[#4A4A50] mt-3">
            Destaques do Menu
          </h2>
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="h-px w-12 bg-[#D4B85A]/40" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#D4B85A]/60" />
            <div className="h-px w-12 bg-[#D4B85A]/40" />
          </div>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.slice(0, 6).map((item) => (
            <div
              key={item.id}
              className="group bg-white/50 backdrop-blur-md rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all"
            >
              {/* Image area */}
              <div className="aspect-[4/3] bg-gradient-to-br from-[#C4B5A3]/30 to-[#EDE8E1] flex items-center justify-center overflow-hidden">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="text-center p-6">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[#D4B85A]/10 flex items-center justify-center">
                      <Star className="w-7 h-7 text-[#D4B85A]" />
                    </div>
                    <span className="font-[family-name:var(--font-cormorant)] text-lg text-[#4A4A50]/50 italic">
                      {item.category}
                    </span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-[family-name:var(--font-old-standard)] text-lg font-bold text-[#4A4A50] truncate">
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className="text-sm text-[#4A4A50]/60 mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 font-semibold text-[#D4B85A] text-lg">
                    {formatBRL(item.price)}
                  </span>
                </div>

                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-[#D4B85A]/10 text-[#D4B85A] font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-10">
          <Link
            href="/cardapio"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full border-2 border-[#D4B85A] text-[#D4B85A] font-semibold hover:bg-[#D4B85A] hover:text-white transition-all"
          >
            Ver cardápio completo →
          </Link>
        </div>
      </div>
    </section>
  );
}
