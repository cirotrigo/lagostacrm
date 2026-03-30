'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Utensils, MapPin, MessageCircle, ChefHat, Star, X } from 'lucide-react';

export function HeroSection() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <section className="relative min-h-[95vh] flex items-center justify-center overflow-hidden">
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
        <p className="font-[family-name:var(--font-pinyon)] text-2xl sm:text-3xl lg:text-4xl text-[#963550] mb-8 animate-[slideUp_0.8s_ease-out_0.4s_forwards] opacity-0">
          Gastronomia franco-italiana com curadoria de vinhos e harmonizações
        </p>

        {/* Divider */}
        <div className="flex items-center justify-center gap-4 mb-10 animate-[fadeIn_0.8s_ease-out_0.5s_forwards] opacity-0">
          <div className="h-px w-16 bg-[#D4B85A]/40" />
          <div className="w-2 h-2 rounded-full bg-[#D4B85A]/60" />
          <div className="h-px w-16 bg-[#D4B85A]/40" />
        </div>

        {/* Quick Access Buttons Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 animate-[slideUp_0.8s_ease-out_0.6s_forwards] opacity-0 w-full max-w-4xl mx-auto">
          <Link
            href="/cardapio"
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/60 backdrop-blur-md border border-[#D4B85A]/20 text-[#4A4A50] hover:bg-[#D4B85A] hover:text-white transition-all shadow-sm hover:shadow-lg hover:-translate-y-1 group"
          >
            <Utensils className="w-6 h-6 text-[#D4B85A] group-hover:text-white transition-colors" />
            <span className="text-sm font-semibold">Cardápio</span>
          </Link>
          
          <Link
            href="/#localizacao"
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/60 backdrop-blur-md border border-[#D4B85A]/20 text-[#4A4A50] hover:bg-[#D4B85A] hover:text-white transition-all shadow-sm hover:shadow-lg hover:-translate-y-1 group"
          >
            <MapPin className="w-6 h-6 text-[#D4B85A] group-hover:text-white transition-colors" />
            <span className="text-sm font-semibold">Localização</span>
          </Link>
          
          <a
            href="https://wa.me/5527998245566?text=Ol%C3%A1%21+Gostaria+de+fazer+uma+reserva."
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-[#D4B85A] text-white hover:bg-[#c5a94d] transition-all shadow-md hover:shadow-lg hover:-translate-y-1 col-span-2 md:col-span-1"
          >
            <MessageCircle className="w-6 h-6" />
            <span className="text-sm font-bold">Reservar</span>
          </a>
          
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/60 backdrop-blur-md border border-[#963550]/20 text-[#4A4A50] hover:bg-[#963550] hover:text-white transition-all shadow-sm hover:shadow-lg hover:-translate-y-1 group"
          >
            <ChefHat className="w-6 h-6 text-[#963550] group-hover:text-white transition-colors" />
            <span className="text-sm font-semibold whitespace-nowrap">Rest. Week</span>
          </button>
          
          <a
            href="https://g.page/r/ChEK7_X_X_X_X_E/review"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/60 backdrop-blur-md border border-[#D4B85A]/20 text-[#4A4A50] hover:bg-white hover:text-black transition-all shadow-sm hover:shadow-lg hover:-translate-y-1 group"
          >
            <Star className="w-6 h-6 text-yellow-500" />
            <span className="text-sm font-semibold whitespace-nowrap">Avaliação</span>
          </a>
        </div>
      </div>

      {/* Restaurant Week Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-[fadeIn_0.3s_ease-out]">
          <div className="relative w-full max-w-lg bg-[#EDE8E1] rounded-3xl p-6 sm:p-8 shadow-2xl animate-[slideUp_0.3s_ease-out] max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/50 text-[#4A4A50] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="text-center mb-6">
              <span className="inline-block px-4 py-1.5 rounded-full bg-[#963550]/10 text-[#963550] text-xs font-bold tracking-[0.2em] uppercase mb-4 mt-2">
                26 de março a 26 de abril
              </span>
              <h2 className="font-[family-name:var(--font-old-standard)] text-3xl font-bold text-[#4A4A50]">
                Restaurant Week
              </h2>
            </div>
            
            {/* Almoço */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4 border-b border-[#D4B85A]/30 pb-2">
                <h3 className="text-xl font-bold text-[#D4B85A] font-[family-name:var(--font-old-standard)]">
                  Menu Almoço
                </h3>
                <span className="font-bold text-[#4A4A50] bg-white/50 px-3 py-1 rounded-full text-sm">
                  R$ 95
                </span>
              </div>
              
              <div className="space-y-4 text-[#4A4A50]">
                <div className="bg-white/60 rounded-2xl p-4">
                  <h4 className="font-bold text-sm mb-1 text-[#963550] flex items-center gap-2">
                    <Utensils className="w-3.5 h-3.5" /> Entradas
                  </h4>
                  <p className="text-sm leading-relaxed">
                    Fish Cake com molho tártaro <span className="text-[#C4B5A3] mx-1">ou</span> Salada de grãos e folhas ao molho campanha.
                  </p>
                </div>
                
                <div className="bg-white/60 rounded-2xl p-4">
                  <h4 className="font-bold text-sm mb-1 text-[#963550] flex items-center gap-2">
                    <ChefHat className="w-3.5 h-3.5" /> Pratos Principais
                  </h4>
                  <p className="text-sm leading-relaxed">
                    Risoto de filé, cogumelo e pangrattato de bacon <span className="text-[#C4B5A3] mx-1">ou</span> Tilápia empanada, purê de banana da terra e pesto de coentro.
                  </p>
                </div>
                
                <div className="bg-white/60 rounded-2xl p-4">
                  <h4 className="font-bold text-sm mb-1 text-[#963550] flex items-center gap-2">
                    <Star className="w-3.5 h-3.5" /> Sobremesas
                  </h4>
                  <p className="text-sm leading-relaxed">
                    Mousse de chocolate com geleia de frutas vermelhas <span className="text-[#C4B5A3] mx-1">ou</span> Cremoso de queijo com calda de goiabada cascão e lascas de parmesão.
                  </p>
                </div>
              </div>
            </div>

            {/* Jantar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4 border-b border-[#D4B85A]/30 pb-2">
                <h3 className="text-xl font-bold text-[#D4B85A] font-[family-name:var(--font-old-standard)]">
                  Menu Jantar
                </h3>
                <span className="font-bold text-[#4A4A50] bg-white/50 px-3 py-1 rounded-full text-sm">
                  R$ 115
                </span>
              </div>
              
              <div className="space-y-4 text-[#4A4A50]">
                <div className="bg-white/60 rounded-2xl p-4">
                  <h4 className="font-bold text-sm mb-1 text-[#963550] flex items-center gap-2">
                    <Utensils className="w-3.5 h-3.5" /> Entradas
                  </h4>
                  <p className="text-sm leading-relaxed">
                    Tempura de legumes com molho picante e gergelim <span className="text-[#C4B5A3] mx-1">ou</span> Crudo de salmão com vinagrete de maçã verde.
                  </p>
                </div>
                
                <div className="bg-white/60 rounded-2xl p-4">
                  <h4 className="font-bold text-sm mb-1 text-[#963550] flex items-center gap-2">
                    <ChefHat className="w-3.5 h-3.5" /> Pratos Principais
                  </h4>
                  <p className="text-sm leading-relaxed">
                    Polenta com ragu de cupim, parmesão e cebola crispy <span className="text-[#C4B5A3] mx-1">ou</span> Risoto de camarão com abóbora assada e coentro.
                  </p>
                </div>
                
                <div className="bg-white/60 rounded-2xl p-4">
                  <h4 className="font-bold text-sm mb-1 text-[#963550] flex items-center gap-2">
                    <Star className="w-3.5 h-3.5" /> Sobremesas
                  </h4>
                  <p className="text-sm leading-relaxed">
                    Mini brownie de chocolate amargo com calda de baunilha <span className="text-[#C4B5A3] mx-1">ou</span> Tiramisù de banana com coco queimado.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-8 text-center sticky bottom-0 bg-[#EDE8E1] pt-4 border-t border-[#C4B5A3]/20">
              <a
                 href="https://wa.me/5527998245566?text=Ol%C3%A1%21+Gostaria+de+fazer+uma+reserva+para+o+Restaurant+Week."
                 target="_blank"
                 rel="noopener noreferrer"
                 className="inline-flex items-center justify-center gap-2 w-full px-6 py-4 rounded-full bg-[#D4B85A] text-white font-bold hover:bg-[#c5a94d] transition-all shadow-md"
              >
                Reservar Mesa para o Rest. Week
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
