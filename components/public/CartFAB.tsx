'use client';

import { ShoppingBag } from 'lucide-react';
import { formatBRL } from '@/lib/public-menu';

type Props = {
  totalItems: number;
  totalPrice: number;
  onClick: () => void;
};

export function CartFAB({ totalItems, totalPrice, onClick }: Props) {
  if (totalItems === 0) return null;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-3 px-5 py-3.5 rounded-full bg-[#D4B85A] text-white shadow-xl hover:bg-[#c5a94d] hover:shadow-2xl hover:scale-105 transition-all animate-[slideUp_0.3s_ease-out]"
    >
      <div className="relative">
        <ShoppingBag className="w-5 h-5" />
        <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#963550] text-[10px] font-bold flex items-center justify-center">
          {totalItems}
        </span>
      </div>
      <span className="font-semibold text-sm">{formatBRL(totalPrice)}</span>
    </button>
  );
}
