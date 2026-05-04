'use client';

import Link from 'next/link';
import { Utensils, MapPin, MessageCircle, Star } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative min-h-[95vh] flex items-center justify-center overflow-hidden">
      {/* Background texture overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#EDE8E1] via-[#E5DDD4] to-[#EDE8E1]" />

      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-64 h-64 bg-[#D4B85A]/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-80 h-80 bg-[#963550]/5 rounded-full blur-3xl" />

      <div className="relative z-10 w-full mx-auto max-w-7xl px-6 lg:flex lg:items-center lg:gap-16 pt-12 pb-24">
        {/* Left Column (Text & Buttons) */}
        <div className="text-left w-full lg:w-1/2 mx-auto lg:mx-0">
          {/* Small label */}
          <div className="mb-6 animate-[fadeIn_0.8s_ease-out_forwards]">
            <span className="inline-block px-4 py-1.5 rounded-full bg-[#D4B85A]/10 text-[#D4B85A] text-xs font-semibold tracking-[0.2em] uppercase border border-[#D4B85A]/20">
              Jardim Camburi — Vitória
            </span>
          </div>

          {/* Brand name */}
          <h1 className="font-[family-name:var(--font-old-standard)] text-6xl sm:text-7xl lg:text-[5.5rem] leading-[0.95] font-bold text-[#4A4A50] tracking-tight mb-8 animate-[slideUp_0.8s_ease-out_0.2s_forwards] opacity-0">
            Empório<br />Fonseca
          </h1>

          {/* Tagline */}
          <p className="text-lg sm:text-xl text-[#4A4A50]/70 mb-10 animate-[slideUp_0.8s_ease-out_0.4s_forwards] opacity-0 leading-relaxed font-[family-name:var(--font-cormorant)]">
            Mergulhe na genialidade da gastronomia franco-italiana. Uma curadoria impecável de vinhos e harmonizações em um ambiente intimamente encantador.
          </p>

          {/* Quick Access Buttons Grid - Reorganized for side layout AND Mobile */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-10 animate-[slideUp_0.8s_ease-out_0.6s_forwards] opacity-0">
            <Link
              href="/cardapio"
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/60 backdrop-blur-md border border-[#D4B85A]/20 text-[#4A4A50] hover:bg-[#D4B85A] hover:text-white transition-all shadow-sm hover:shadow-lg hover:-translate-y-1 group"
            >
              <Utensils className="w-5 h-5 text-[#D4B85A] group-hover:text-white transition-colors" />
              <span className="text-sm font-semibold">Cardápio</span>
            </Link>
            
            <Link
              href="/#localizacao"
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/60 backdrop-blur-md border border-[#D4B85A]/20 text-[#4A4A50] hover:bg-[#D4B85A] hover:text-white transition-all shadow-sm hover:shadow-lg hover:-translate-y-1 group"
            >
              <MapPin className="w-5 h-5 text-[#D4B85A] group-hover:text-white transition-colors" />
              <span className="text-sm font-semibold">Localização</span>
            </Link>
            
            <a
              href="https://wa.me/5527998245566?text=Ol%C3%A1%21+Gostaria+de+fazer+uma+reserva."
              target="_blank"
              rel="noopener noreferrer"
              className="col-span-2 flex flex-col sm:flex-row items-center justify-center gap-2 p-4 rounded-2xl bg-[#D4B85A] text-white hover:bg-[#c5a94d] transition-all shadow-md hover:shadow-lg hover:-translate-y-1"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="text-sm font-bold">Reservar via WhatsApp</span>
            </a>
            
            <a
              href="https://g.page/r/ChEK7_X_X_X_X_E/review"
              target="_blank"
              rel="noopener noreferrer"
              className="col-span-2 flex flex-col sm:flex-row items-center justify-center gap-2 p-4 rounded-2xl bg-white/60 backdrop-blur-md border border-[#D4B85A]/20 text-[#4A4A50] hover:bg-white hover:text-black transition-all shadow-sm hover:shadow-lg hover:-translate-y-1 group"
            >
              <Star className="w-5 h-5 text-yellow-500" />
              <span className="text-sm font-semibold whitespace-nowrap">Avaliação</span>
            </a>
          </div>
        </div>

        {/* Right Column (Images Layout - Museum Style) */}
        <div className="w-full lg:w-1/2 relative h-[400px] lg:h-[700px] mt-12 lg:mt-0 animate-[fadeIn_1.2s_ease-out_forwards]">
          {/* Main Arched Image */}
          <div className="absolute right-0 top-0 w-full lg:w-[90%] h-full lg:h-[650px] overflow-hidden rounded-t-[200px] lg:rounded-t-[300px] rounded-b-3xl shadow-2xl z-0">
            <img 
              src="/images/hero-fachada.jpg" 
              alt="Fachada do Restaurante" 
              className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
          </div>

          {/* Floating Image Mini - Top Left */}
          <div className="hidden lg:block absolute left-[5%] top-[15%] w-56 h-72 rounded-2xl overflow-hidden shadow-[0_20px_40px_-15px_rgba(0,0,0,0.3)] transform -rotate-[8deg] border-8 border-white z-10 hover:-rotate-[4deg] transition-all duration-500">
            <img 
              src="/images/hero-prato.jpg" 
              alt="Prato do restaurante" 
              className="w-full h-full object-cover"
            />
          </div>

        </div>
      </div>
    </section>
  );
}
