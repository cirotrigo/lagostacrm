'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { href: '/#sobre', label: 'Sobre' },
  { href: '/cardapio', label: 'Cardápio' },
  { href: '/#localizacao', label: 'Contato' },
];

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#EDE8E1]/90 backdrop-blur-md border-b border-[#C4B5A3]/30">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        <Link href="/" className="hover:opacity-80 transition-opacity flex items-center">
          <img src="/logos/logo-bordo.png" alt="Empório Fonseca Logo" className="h-10 w-auto object-contain" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[#4A4A50] hover:text-[#D4B85A] transition-colors tracking-wide uppercase"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/cardapio"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#D4B85A] text-white text-sm font-semibold hover:bg-[#c5a94d] transition-all shadow-sm hover:shadow-md"
          >
            Fazer Pedido
          </Link>
        </nav>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-[#C4B5A3]/20 transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[#C4B5A3]/30 bg-[#EDE8E1]/95 backdrop-blur-md">
          <nav className="flex flex-col px-6 py-4 gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm font-medium text-[#4A4A50] hover:text-[#D4B85A] transition-colors tracking-wide uppercase py-2"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/cardapio"
              onClick={() => setMobileOpen(false)}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-[#D4B85A] text-white text-sm font-semibold hover:bg-[#c5a94d] transition-all mt-2"
            >
              Fazer Pedido
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
