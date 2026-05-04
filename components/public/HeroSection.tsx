'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Utensils, MapPin, MessageCircle, Star, ChefHat, X } from 'lucide-react';

export function HeroSection() {
  const [isPizzaModalOpen, setIsPizzaModalOpen] = useState(false);

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
            
            <button
              onClick={() => setIsPizzaModalOpen(true)}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/60 backdrop-blur-md border border-[#963550]/20 text-[#4A4A50] hover:bg-[#963550] hover:text-white transition-all shadow-sm hover:shadow-lg hover:-translate-y-1 group"
            >
              <ChefHat className="w-5 h-5 text-[#963550] group-hover:text-white transition-colors" />
              <span className="text-sm font-semibold whitespace-nowrap">Dia da Pizza</span>
            </button>

            <a
              href="https://g.page/r/ChEK7_X_X_X_X_E/review"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/60 backdrop-blur-md border border-[#D4B85A]/20 text-[#4A4A50] hover:bg-white hover:text-black transition-all shadow-sm hover:shadow-lg hover:-translate-y-1 group"
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

          {/* Floating Pizza Ticket - Bottom Left */}
          <div className="hidden lg:block absolute left-0 bottom-[10%] w-[320px] bg-[#C5BDB1] rounded-lg shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)] transform rotate-[6deg] z-20 overflow-hidden hover:rotate-[3deg] hover:-translate-y-2 transition-all duration-500 cursor-pointer" onClick={() => setIsPizzaModalOpen(true)}>
            <div className="h-3 w-full" style={{ backgroundImage: 'radial-gradient(circle, transparent 4px, #C5BDB1 5px)', backgroundSize: '12px 10px', backgroundPosition: 'top -2px center' }}></div>

            <div className="px-6 py-5 border-b border-[#4A4A50]/10">
              <span className="text-[9px] font-bold tracking-widest text-[#4A4A50]/60 uppercase block mb-1">
                Toda quarta-feira
              </span>
              <h3 className="font-[family-name:var(--font-old-standard)] text-2xl font-bold text-[#4A4A50]">
                Dia da Pizza 🍕
              </h3>
            </div>

            <div className="px-6 py-5">
              <span className="text-[9px] uppercase tracking-widest text-[#4A4A50]/50 block mb-1">A partir de</span>
              <span className="text-2xl font-bold text-[#4A4A50]">R$ 79,90</span>
            </div>

            <div className="h-3 w-full bg-white relative" style={{ backgroundImage: 'radial-gradient(circle, #C5BDB1 4px, transparent 5px)', backgroundSize: '12px 10px', backgroundPosition: 'bottom -2px center' }}></div>
          </div>

        </div>
      </div>

      {/* Dia da Pizza Modal */}
      {isPizzaModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-[fadeIn_0.3s_ease-out]">
          <div className="relative w-full max-w-lg bg-[#EDE8E1] rounded-3xl p-6 sm:p-8 shadow-2xl animate-[slideUp_0.3s_ease-out] max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsPizzaModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/50 text-[#4A4A50] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <span className="inline-block px-4 py-1.5 rounded-full bg-[#963550]/10 text-[#963550] text-xs font-bold tracking-[0.2em] uppercase mb-4 mt-2">
                Toda quarta-feira
              </span>
              <h2 className="font-[family-name:var(--font-old-standard)] text-3xl font-bold text-[#4A4A50]">
                Dia da Pizza 🍕
              </h2>
              <p className="mt-2 text-[#4A4A50]/70 text-sm">A partir de R$ 79,90</p>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-bold text-[#963550] mb-3 uppercase tracking-wider">Sabores mais comuns</h3>
              <div className="space-y-3 text-[#4A4A50]">
                <div className="bg-white/60 rounded-2xl p-4">
                  <p className="text-sm font-semibold">Queijo, Parma e Mel</p>
                </div>
                <div className="bg-white/60 rounded-2xl p-4">
                  <p className="text-sm font-semibold">Queijo, Pepperoni e Tapenade de Azeitona Preta</p>
                </div>
                <div className="bg-white/60 rounded-2xl p-4">
                  <p className="text-sm font-semibold">Caprese</p>
                  <p className="text-xs text-[#4A4A50]/60 mt-1">Mozzarela de búfala, tomate cereja confitado e manjericão</p>
                </div>
              </div>
            </div>

            <div className="bg-[#D4B85A]/10 rounded-2xl p-4 mb-6 text-center">
              <p className="text-xs text-[#4A4A50]/80 leading-relaxed">
                Os sabores variam toda semana! Confira os <strong>destaques do @emporiofonseca</strong> no Instagram ou pergunte ao garçom para ver as opções do dia.
              </p>
            </div>

            <div className="text-center">
              <a
                 href="https://wa.me/5527998245566?text=Ol%C3%A1%21+Quero+saber+os+sabores+do+Dia+da+Pizza+desta+semana."
                 target="_blank"
                 rel="noopener noreferrer"
                 className="inline-flex items-center justify-center gap-2 w-full px-6 py-4 rounded-full bg-[#D4B85A] text-white font-bold hover:bg-[#c5a94d] transition-all shadow-md"
              >
                Reservar via WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
