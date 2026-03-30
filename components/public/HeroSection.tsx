import Link from 'next/link';

export function HeroSection() {
  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
      {/* Background texture overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#EDE8E1] via-[#E5DDD4] to-[#EDE8E1]" />

      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-64 h-64 bg-[#D4B85A]/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-80 h-80 bg-[#963550]/5 rounded-full blur-3xl" />

      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        {/* Small label */}
        <div className="mb-6 animate-[fadeIn_0.8s_ease-out_forwards]">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[#D4B85A]/10 text-[#D4B85A] text-xs font-semibold tracking-[0.2em] uppercase border border-[#D4B85A]/20">
            Gastronomia Franco-Italiana
          </span>
        </div>

        {/* Brand name */}
        <h1 className="font-[family-name:var(--font-old-standard)] text-5xl sm:text-6xl lg:text-8xl font-bold text-[#4A4A50] tracking-wide mb-6 animate-[slideUp_0.8s_ease-out_0.2s_forwards] opacity-0">
          Empório Fonseca
        </h1>

        {/* Tagline in script font */}
        <p className="font-[family-name:var(--font-pinyon)] text-2xl sm:text-3xl lg:text-4xl text-[#963550] mb-10 animate-[slideUp_0.8s_ease-out_0.4s_forwards] opacity-0">
          Onde cada detalhe é pensado para criar uma experiência única
        </p>

        {/* Divider */}
        <div className="flex items-center justify-center gap-4 mb-10 animate-[fadeIn_0.8s_ease-out_0.5s_forwards] opacity-0">
          <div className="h-px w-16 bg-[#D4B85A]/40" />
          <div className="w-2 h-2 rounded-full bg-[#D4B85A]/60" />
          <div className="h-px w-16 bg-[#D4B85A]/40" />
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-[slideUp_0.8s_ease-out_0.6s_forwards] opacity-0">
          <Link
            href="/cardapio"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[#D4B85A] text-white font-semibold hover:bg-[#c5a94d] transition-all shadow-lg hover:shadow-xl hover:scale-105"
          >
            Ver Cardápio
          </Link>
          <Link
            href="/#sobre"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full border-2 border-[#4A4A50]/20 text-[#4A4A50] font-semibold hover:border-[#4A4A50]/40 hover:bg-white/50 transition-all"
          >
            Conheça nossa história
          </Link>
        </div>
      </div>
    </section>
  );
}
