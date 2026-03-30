'use client';

import { useEffect, useRef, useState } from 'react';
import { type MenuCategory } from '@/lib/public-menu';

type Props = {
  categories: MenuCategory[];
};

export function MenuCategoryNav({ categories }: Props) {
  const [activeSlug, setActiveSlug] = useState(categories[0]?.slug || '');
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSlug(entry.target.id);
          }
        }
      },
      { rootMargin: '-120px 0px -60% 0px', threshold: 0 },
    );

    for (const cat of categories) {
      const el = document.getElementById(cat.slug);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [categories]);

  const scrollToCategory = (slug: string) => {
    const el = document.getElementById(slug);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Scroll active pill into view in nav
  useEffect(() => {
    if (!navRef.current) return;
    const activeBtn = navRef.current.querySelector(`[data-slug="${activeSlug}"]`);
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeSlug]);

  return (
    <div className="sticky top-[65px] z-30 bg-[#EDE8E1]/95 backdrop-blur-md border-b border-[#C4B5A3]/20 py-3">
      <div
        ref={navRef}
        className="mx-auto max-w-7xl px-4 flex gap-2 overflow-x-auto scrollbar-hide"
      >
        {categories.map((cat) => (
          <button
            key={cat.slug}
            data-slug={cat.slug}
            onClick={() => scrollToCategory(cat.slug)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
              activeSlug === cat.slug
                ? 'bg-[#D4B85A] text-white shadow-sm'
                : 'bg-white/60 text-[#4A4A50]/70 hover:bg-white hover:text-[#4A4A50]'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
}
