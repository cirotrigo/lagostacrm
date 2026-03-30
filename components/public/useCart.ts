'use client';

import { useState, useCallback } from 'react';
import { type MenuItem, formatBRL, WHATSAPP_NUMBER } from '@/lib/public-menu';

export type CartItem = {
  product: MenuItem;
  quantity: number;
};

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  const addItem = useCallback((product: MenuItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.product.id !== productId));
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity } : i)),
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setIsOpen(false);
  }, []);

  const buildWhatsAppMessage = useCallback(() => {
    if (items.length === 0) return '';

    const lines = items.map(
      (i) => `• ${i.quantity}x ${i.product.name} — ${formatBRL(i.product.price * i.quantity)}`,
    );

    return [
      'Olá! Gostaria de fazer um pedido para retirada:',
      '',
      '🛒 *Meu Pedido*',
      ...lines,
      '',
      `💰 *Total: ${formatBRL(totalPrice)}*`,
      '',
      'Aguardo confirmação! 😊',
    ].join('\n');
  }, [items, totalPrice]);

  const getWhatsAppUrl = useCallback(() => {
    const msg = buildWhatsAppMessage();
    const number = WHATSAPP_NUMBER;
    if (!number) return null;
    return `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;
  }, [buildWhatsAppMessage]);

  return {
    items,
    totalItems,
    totalPrice,
    isOpen,
    setIsOpen,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    buildWhatsAppMessage,
    getWhatsAppUrl,
  };
}
