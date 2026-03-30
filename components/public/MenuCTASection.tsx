import Link from 'next/link';

export function MenuCTASection() {
  return (
    <section className="py-20 px-6">
      <div className="mx-auto max-w-4xl">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#4A4A50] to-[#2d2d30] p-10 md:p-16 text-center">
          {/* Decorative */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4B85A]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#963550]/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10">
            <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#D4B85A]">
              Menu Digital
            </span>
            <h2 className="font-[family-name:var(--font-old-standard)] text-3xl sm:text-4xl font-bold text-white mt-4 mb-4">
              Explore nosso cardápio
            </h2>
            <p className="text-[#C4B5A3] max-w-lg mx-auto mb-8 leading-relaxed">
              Das entradas aos métodos filtrados, cada item do nosso menu foi pensado
              para surpreender. Monte seu pedido e envie direto pelo WhatsApp.
            </p>
            <Link
              href="/cardapio"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[#D4B85A] text-white font-semibold hover:bg-[#c5a94d] transition-all shadow-lg hover:shadow-xl hover:scale-105"
            >
              Abrir Cardápio Digital
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
