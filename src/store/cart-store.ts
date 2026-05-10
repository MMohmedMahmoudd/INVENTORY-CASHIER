import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Cart, CartItem, Customer, PaymentMethod, Product, ProductVariant } from "@/types";
import { TAX_RATE } from "@/lib/constants";

// Unique key for a cart line: productId + optional variantId
function cartKey(productId: string, variantId?: string) {
  return `${productId}:${variantId ?? ""}`;
}

interface CartState extends Cart {
  addItem: (product: Product, quantity?: number, variant?: ProductVariant) => void;
  removeItem: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  updateItemDiscount: (productId: string, discount: number, variantId?: string) => void;
  setCustomer: (customer: Customer | null) => void;
  setDiscount: (discount: number) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  clearCart: () => void;
  recalculate: () => void;
}

const initialCart: Cart = {
  items: [],
  customer: null,
  subtotal: 0,
  tax: 0,
  discount: 0,
  total: 0,
  payment_method: "cash",
};

function calcTotals(items: CartItem[], cartDiscount: number): Pick<Cart, "subtotal" | "tax" | "discount" | "total"> {
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const tax = subtotal * TAX_RATE;
  return { subtotal, tax, discount: cartDiscount, total: Math.max(0, subtotal + tax - cartDiscount) };
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      ...initialCart,

      addItem: (product, quantity = 1, variant?) => {
        set((state) => {
          const key = cartKey(product.id, variant?.id);
          const existing = state.items.find(
            (i) => cartKey(i.product.id, i.variant?.id) === key
          );
          // Variant price takes precedence over base product price
          const price = variant?.selling_price ?? product.selling_price;
          let items: CartItem[];
          if (existing) {
            items = state.items.map((i) =>
              cartKey(i.product.id, i.variant?.id) === key
                ? { ...i, quantity: i.quantity + quantity, total: (i.quantity + quantity) * i.unit_price }
                : i
            );
          } else {
            items = [
              ...state.items,
              { product, variant, quantity, unit_price: price, total: price * quantity, discount: 0 },
            ];
          }
          return { items, ...calcTotals(items, state.discount) };
        });
      },

      removeItem: (productId, variantId?) => {
        set((state) => {
          const key = cartKey(productId, variantId);
          const items = state.items.filter(
            (i) => cartKey(i.product.id, i.variant?.id) !== key
          );
          return { items, ...calcTotals(items, state.discount) };
        });
      },

      updateQuantity: (productId, quantity, variantId?) => {
        if (quantity <= 0) { get().removeItem(productId, variantId); return; }
        set((state) => {
          const key = cartKey(productId, variantId);
          const items = state.items.map((i) =>
            cartKey(i.product.id, i.variant?.id) === key
              ? { ...i, quantity, total: quantity * i.unit_price }
              : i
          );
          return { items, ...calcTotals(items, state.discount) };
        });
      },

      updateItemDiscount: (productId, discount, variantId?) => {
        set((state) => {
          const key = cartKey(productId, variantId);
          const items = state.items.map((i) =>
            cartKey(i.product.id, i.variant?.id) === key
              ? { ...i, discount, total: i.quantity * i.unit_price * (1 - discount / 100) }
              : i
          );
          return { items, ...calcTotals(items, state.discount) };
        });
      },

      setCustomer: (customer) => set({ customer }),

      setDiscount: (discount) => {
        set((state) => ({ ...calcTotals(state.items, discount), discount }));
      },

      setPaymentMethod: (payment_method) => set({ payment_method }),

      clearCart: () => set({ ...initialCart }),

      recalculate: () => {
        set((state) => ({ ...calcTotals(state.items, state.discount) }));
      },
    }),
    { name: "invenpos-cart" }
  )
);
