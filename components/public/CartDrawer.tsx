'use client';

import { X, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { type CartItem } from './useCart';
import { formatBRL } from '@/lib/public-menu';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  totalPrice: number;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
  whatsappUrl: string | null;
  whatsappMessage: string;
};

export function CartDrawer({
  isOpen,
  onClose,
  items,
  totalPrice,
  onUpdateQuantity,
  onRemove,
  onClear,
  whatsappUrl,
  whatsappMessage,
}: Props) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] bg-[#F5F0EB] rounded-t-3xl shadow-2xl flex flex-col animate-[slideUp_0.3s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#C4B5A3]/20">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-5 h-5 text-[#D4B85A]" />
            <h2 className="font-[family-name:var(--font-old-standard)] text-lg font-bold text-[#4A4A50]">
              Seu Pedido
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#D4B85A]/10 text-[#D4B85A] font-medium">
              {items.length} {items.length === 1 ? 'item' : 'itens'}
            </span>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#C4B5A3]/20 transition-colors">
            <X className="w-5 h-5 text-[#4A4A50]" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="w-12 h-12 text-[#C4B5A3] mx-auto mb-3" />
              <p className="text-sm text-[#4A4A50]/50">Seu pedido está vazio.</p>
              <p className="text-xs text-[#4A4A50]/40 mt-1">Adicione itens do cardápio.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/60 border border-[#C4B5A3]/10"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-[#4A4A50] truncate">
                      {item.product.name}
                    </h4>
                    <span className="text-xs text-[#D4B85A] font-medium">
                      {formatBRL(item.product.price)} cada
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                      className="w-7 h-7 rounded-full bg-[#C4B5A3]/20 text-[#4A4A50] flex items-center justify-center hover:bg-[#C4B5A3]/30 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold text-[#4A4A50]">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                      className="w-7 h-7 rounded-full bg-[#D4B85A] text-white flex items-center justify-center hover:bg-[#c5a94d] transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-right shrink-0 w-20">
                    <span className="text-sm font-semibold text-[#4A4A50]">
                      {formatBRL(item.product.price * item.quantity)}
                    </span>
                  </div>

                  <button
                    onClick={() => onRemove(item.product.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-6 py-4 border-t border-[#C4B5A3]/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#4A4A50]">Total</span>
              <span className="font-[family-name:var(--font-old-standard)] text-xl font-bold text-[#D4B85A]">
                {formatBRL(totalPrice)}
              </span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClear}
                className="px-4 py-3 rounded-full border border-[#C4B5A3]/30 text-sm text-[#4A4A50]/70 hover:bg-[#C4B5A3]/10 transition-colors"
              >
                Limpar
              </button>
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-green-600 text-white font-semibold hover:bg-green-700 transition-all shadow-lg"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Enviar Pedido pelo WhatsApp
                </a>
              ) : (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(whatsappMessage);
                    alert('Pedido copiado! Cole no WhatsApp do Empório Fonseca.');
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#D4B85A] text-white font-semibold hover:bg-[#c5a94d] transition-all shadow-lg"
                >
                  Copiar Pedido
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
