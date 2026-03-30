import { MapPin, Clock, Instagram } from 'lucide-react';
import { WHATSAPP_NUMBER } from '@/lib/public-menu';

export function LocationSection() {
  const whatsappLink = `https://wa.me/5527998245566?text=${encodeURIComponent('Olá! Gostaria de fazer uma reserva.')}`;

  return (
    <section id="localizacao" className="py-20 px-6">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-12">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#D4B85A]">
            Localização
          </span>
          <h2 className="font-[family-name:var(--font-old-standard)] text-3xl sm:text-4xl font-bold text-[#4A4A50] mt-3">
            Visite-nos
          </h2>
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="h-px w-12 bg-[#D4B85A]/40" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#D4B85A]/60" />
            <div className="h-px w-12 bg-[#D4B85A]/40" />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Info */}
          <div className="bg-white/50 backdrop-blur-md rounded-3xl p-8 shadow-sm">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[#D4B85A]/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-[#D4B85A]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#4A4A50] mb-1">Endereço</h3>
                  <p className="text-sm text-[#4A4A50]/80">
                    Vitória – ES
                    <br />
                    <span className="text-[#C4B5A3] italic text-xs">Av. Raul Oliveira Neves, Jardim Camburi</span>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[#D4B85A]/10 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-[#D4B85A]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#4A4A50] mb-1">Horários</h3>
                  <div className="text-sm text-[#4A4A50]/80 space-y-1">
                    <p>Ter a Qui: 09h às 22h</p>
                    <p>Sex e Sáb: 09h às 23h</p>
                    <p>Domingo: 09h às 16h</p>
                    <p className="text-[#C4B5A3] italic text-xs pt-1">Segunda-feira: Fechado</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-[#C4B5A3]/20">
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-all shadow-sm hover:shadow-md"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    Reservas via WhatsApp
                  </a>
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] text-white text-sm font-semibold hover:opacity-90 transition-all"
                >
                  <Instagram className="w-4 h-4" />
                  Instagram
                </a>
              </div>
            </div>
          </div>

          {/* Map Embed */}
          <div className="bg-white/50 backdrop-blur-md rounded-3xl overflow-hidden shadow-sm min-h-[300px] h-full relative">
            <iframe
              src="https://maps.google.com/maps?q=Emp%C3%B3rio+Fonseca+Vix%2C+Vit%C3%B3ria&t=&z=16&ie=UTF8&iwloc=&output=embed"
              width="100%"
              height="100%"
              style={{ border: 0, minHeight: '350px' }}
              allowFullScreen={false}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Google Maps - Empório Fonseca"
              className="absolute inset-0 w-full h-full"
            ></iframe>
          </div>
        </div>
      </div>
    </section>
  );
}
