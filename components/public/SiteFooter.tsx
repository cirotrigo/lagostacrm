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
              <Link href="/login" className="text-sm font-semibold text-[#D4B85A] hover:text-white transition-colors mt-2 flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Login CRM
              </Link>
            </nav>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider mb-4 text-[#D4B85A]">
              Contato
            </h4>
            <div className="flex flex-col gap-2 text-sm text-[#C4B5A3]">
              <span>Av. Raul Oliveira Neves</span>
              <span>Jardim Camburi, Vitória – ES</span>
              <span className="mt-2 text-[#EDE8E1]">Ter a Qui: 09h às 22h</span>
              <span className="text-[#EDE8E1]">Sex e Sáb: 09h às 23h</span>
              <span className="text-[#EDE8E1]">Dom: 09h às 16h</span>
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
