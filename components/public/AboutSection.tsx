export function AboutSection() {
  return (
    <section id="sobre" className="py-20 px-6">
      <div className="mx-auto max-w-4xl">
        <div className="bg-white/50 backdrop-blur-md rounded-3xl p-8 md:p-16 shadow-[rgba(255,255,255,0.1)_0px_1px_1px_0px_inset,rgba(50,50,93,0.1)_0px_30px_60px_-20px]">
          {/* Section label */}
          <div className="text-center mb-8">
            <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#D4B85A]">
              Sobre nós
            </span>
          </div>

          <h2 className="font-[family-name:var(--font-old-standard)] text-3xl sm:text-4xl font-bold text-[#4A4A50] text-center mb-8">
            Nossa Essência
          </h2>

          <div className="flex items-center justify-center gap-4 mb-10">
            <div className="h-px w-12 bg-[#D4B85A]/40" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#D4B85A]/60" />
            <div className="h-px w-12 bg-[#D4B85A]/40" />
          </div>

          <div className="max-w-2xl mx-auto space-y-5 text-center">
            <p className="text-base sm:text-lg leading-relaxed text-[#4A4A50]/80">
              No Empório Fonseca, acreditamos que uma boa refeição vai além do paladar.
              É um momento de conexão, de pausa no ritmo do dia, de apreciação pelo que é
              feito com cuidado e intenção.
            </p>
            <p className="text-base sm:text-lg leading-relaxed text-[#4A4A50]/80">
              Nosso menu combina ingredientes selecionados, receitas autorais e uma
              curadoria de cafés especiais para transformar cada visita em uma
              experiência memorável.
            </p>
            <p className="font-[family-name:var(--font-cormorant)] text-xl sm:text-2xl italic text-[#963550] mt-8">
              Gastronomia franco-italiana em Vitória – ES.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
