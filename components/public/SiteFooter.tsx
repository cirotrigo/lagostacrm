import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="bg-[#4A4A50] text-[#EDE8E1]">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <h3 className="font-[family-name:var(--font-old-standard)] text-xl font-bold tracking-wide mb-3">
              EMPÓRIO FONSECA
            </h3>
            <p className="text-sm text-[#C4B5A3] leading-relaxed">
              Gastronomia franco-italiana em Vitória – ES.
              <br />
              Onde cada detalhe é pensado para criar uma experiência única.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider mb-4 text-[#D4B85A]">
              Navegação
            </h4>
            <nav className="flex flex-col gap-2">
              <Link href="/#sobre" className="text-sm text-[#C4B5A3] hover:text-white transition-colors">
                Sobre
              </Link>
              <Link href="/cardapio" className="text-sm text-[#C4B5A3] hover:text-white transition-colors">
                Cardápio
              </Link>
              <Link href="/#localizacao" className="text-sm text-[#C4B5A3] hover:text-white transition-colors">
                Contato
              </Link>
              <Link href="/login" className="text-sm text-[#C4B5A3] hover:text-white transition-colors">
                Área Restrita
              </Link>
            </nav>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider mb-4 text-[#D4B85A]">
              Contato
            </h4>
            <div className="flex flex-col gap-2 text-sm text-[#C4B5A3]">
              <span>Vitória – ES</span>
              <span>Horários em breve</span>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[#C4B5A3]/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#C4B5A3]">
            © {new Date().getFullYear()} Empório Fonseca. Todos os direitos reservados.
          </p>
          <p className="text-xs text-[#C4B5A3]/60">
            Feito com cuidado e bons ingredientes.
          </p>
        </div>
      </div>
    </footer>
  );
}
