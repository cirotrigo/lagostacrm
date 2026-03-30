'use client';

import { type MenuCategory } from '@/lib/public-menu';
import { MenuCategoryNav } from './MenuCategoryNav';
import { MenuItemCard } from './MenuItemCard';
import { CartFAB } from './CartFAB';
import { CartDrawer } from './CartDrawer';
import { useCart } from './useCart';

type Props = {
  categories: MenuCategory[];
};

export function CardapioClient({ categories }: Props) {
  const cart = useCart();

  const getQuantity = (productId: string) =>
    cart.items.find((i) => i.product.id === productId)?.quantity ?? 0;

  return (
    <>
      <MenuCategoryNav categories={categories} />

      <div className="mx-auto max-w-7xl px-4 py-8">
        {categories.map((cat) => (
          <section key={cat.slug} id={cat.slug} className="mb-12 scroll-mt-[140px]">
            {/* Category header */}
            <div className="mb-5">
              <h2 className="font-[family-name:var(--font-old-standard)] text-2xl font-bold text-[#4A4A50]">
                {cat.name}
              </h2>
              <div className="flex items-center gap-3 mt-2">
                <div className="h-px flex-1 bg-[#D4B85A]/20" />
                <span className="text-xs text-[#D4B85A] font-medium">
                  {cat.items.length} {cat.items.length === 1 ? 'item' : 'itens'}
                </span>
                <div className="h-px flex-1 bg-[#D4B85A]/20" />
              </div>
            </div>

            {/* Items grid */}
            <div className="grid sm:grid-cols-2 gap-3">
              {cat.items.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  quantity={getQuantity(item.id)}
                  onAdd={() => cart.addItem(item)}
                  onRemove={() =>
                    cart.updateQuantity(item.id, getQuantity(item.id) - 1)
                  }
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Cart FAB */}
      <CartFAB
        totalItems={cart.totalItems}
        totalPrice={cart.totalPrice}
        onClick={() => cart.setIsOpen(true)}
      />

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={cart.isOpen}
        onClose={() => cart.setIsOpen(false)}
        items={cart.items}
        totalPrice={cart.totalPrice}
        onUpdateQuantity={cart.updateQuantity}
        onRemove={cart.removeItem}
        onClear={cart.clearCart}
        whatsappUrl={cart.getWhatsAppUrl()}
        whatsappMessage={cart.buildWhatsAppMessage()}
      />
    </>
  );
}
