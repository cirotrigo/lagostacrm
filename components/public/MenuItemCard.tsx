'use client';

import { Plus, Minus, Star, ImageIcon } from 'lucide-react';
import { type MenuItem, formatBRL } from '@/lib/public-menu';

type Props = {
  item: MenuItem;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
};

export function MenuItemCard({ item, quantity, onAdd, onRemove }: Props) {
  const isUnavailable = !item.available;

  return (
    <div
      className={`flex gap-4 p-4 rounded-2xl bg-white/50 backdrop-blur-sm border border-[#C4B5A3]/10 transition-all ${
        isUnavailable ? 'opacity-50' : 'hover:shadow-md'
      }`}
    >
      {/* Thumbnail */}
      <div className="shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-[#C4B5A3]/20 to-[#EDE8E1] flex items-center justify-center">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="w-6 h-6 text-[#C4B5A3]" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-[family-name:var(--font-old-standard)] font-bold text-[#4A4A50] truncate">
                {item.name}
              </h3>
              {item.featured && <Star className="w-3.5 h-3.5 text-[#D4B85A] fill-[#D4B85A] shrink-0" />}
            </div>
            {item.description && (
              <p className="text-xs text-[#4A4A50]/60 mt-0.5 line-clamp-2">{item.description}</p>
            )}
          </div>
          <span className="shrink-0 font-semibold text-[#D4B85A]">
            {item.price > 0 ? formatBRL(item.price) : 'Consulte'}
          </span>
        </div>

        {/* Tags + Actions */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex flex-wrap gap-1">
            {isUnavailable && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                Esgotado
              </span>
            )}
            {item.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 rounded-full bg-[#D4B85A]/10 text-[#D4B85A] font-medium"
              >
                {tag}
              </span>
            ))}
          </div>

          {!isUnavailable && (
            <div className="flex items-center gap-1 shrink-0">
              {quantity > 0 ? (
                <>
                  <button
                    onClick={onRemove}
                    className="w-7 h-7 rounded-full bg-[#963550]/10 text-[#963550] flex items-center justify-center hover:bg-[#963550]/20 transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-[#4A4A50]">
                    {quantity}
                  </span>
                  <button
                    onClick={onAdd}
                    className="w-7 h-7 rounded-full bg-[#D4B85A] text-white flex items-center justify-center hover:bg-[#c5a94d] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={onAdd}
                  className="w-7 h-7 rounded-full bg-[#D4B85A] text-white flex items-center justify-center hover:bg-[#c5a94d] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
