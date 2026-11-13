import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert, Platform } from "react-native";

import { Product } from "@/lib/data";
import { deliveryFeeFor } from "@/lib/pricing";

export interface CartItem {
  product: Product;
  quantity: number;
  storeName?: string;
}

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  name: string;
  address: string;
  phone: string;
  placedAt: string;
  status: "placed" | "confirmed" | "delivered";
}

interface CartContextValue {
  items: CartItem[];
  /** False until the saved cart has been read from storage. */
  loaded: boolean;
  addItem: (product: Product, storeName?: string) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  orders: Order[];
  placeOrder: (name: string, address: string, phone: string) => Promise<Order>;
}

// v2: carts and orders saved before the app read real shops held sample items priced in
// US dollars, which would now read as rupees.
const CART_KEY = "ghar_tak_cart_v2";
const ORDERS_KEY = "ghar_tak_orders_v2";
const OLD_KEYS = ["ghar_tak_cart", "ghar_tak_orders"];

/**
 * No more than the shop has, like the website's cart. Items saved in a cart before stock was
 * read have none, so they aren't limited until they are added again from the store.
 */
function withinStock(product: Product, quantity: number) {
  return Number.isFinite(product.stock) ? Math.min(quantity, Math.max(product.stock, 0)) : quantity;
}

/** The website's "Start a new cart?" question; onConfirm runs when the customer agrees. */
function confirmNewCart(fromShop: string, toShop: string, onConfirm: () => void) {
  const title = "Start a new cart?";
  const message = `Your cart has items from ${fromShop}. An order can only come from one store, so adding from ${toShop} will remove them.`;
  if (Platform.OS === "web") {
    // Alert shows no buttons on react-native-web.
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Keep my cart", style: "cancel" },
    { text: "Start new cart", onPress: onConfirm },
  ]);
}

const CartContext = createContext<CartContextValue>({
  items: [],
  loaded: false,
  addItem: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  totalItems: 0,
  totalPrice: 0,
  orders: [],
  placeOrder: async () => ({ id: "", items: [], total: 0, name: "", address: "", phone: "", placedAt: "", status: "placed" }),
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [cartJson, ordersJson] = await Promise.all([
          AsyncStorage.getItem(CART_KEY),
          AsyncStorage.getItem(ORDERS_KEY),
        ]);
        if (cartJson) setItems(JSON.parse(cartJson));
        if (ordersJson) setOrders(JSON.parse(ordersJson));
        AsyncStorage.multiRemove(OLD_KEYS).catch(() => {});
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const saveCart = useCallback(async (next: CartItem[]) => {
    setItems(next);
    try {
      await AsyncStorage.setItem(CART_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  // One shop per cart, like the website: the delivery fee and the free-delivery threshold are a shop's.
  const addItem = useCallback((product: Product, storeName?: string) => {
    const otherShop = items.find((i) => i.product.storeId !== product.storeId);
    if (otherShop) {
      if (withinStock(product, 1) === 0) return;
      confirmNewCart(otherShop.storeName ?? "another store", storeName ?? "this store", () => {
        void saveCart([{ product, quantity: 1, storeName }]);
      });
      return;
    }
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      const quantity = withinStock(product, (existing?.quantity ?? 0) + 1);
      // The newest product details, so the cart's "+" uses today's stock; one now out of stock leaves.
      const next = existing
        ? prev
            .map((i) => (i.product.id === product.id ? { ...i, product, quantity } : i))
            .filter((i) => i.quantity > 0)
        : quantity > 0
          ? [...prev, { product, quantity, storeName }]
          : prev;
      AsyncStorage.setItem(CART_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [items, saveCart]);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.product.id !== productId);
      AsyncStorage.setItem(CART_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) => {
      const next = quantity <= 0
        ? prev.filter((i) => i.product.id !== productId)
        : prev.map((i) => i.product.id === productId ? { ...i, quantity: withinStock(i.product, quantity) } : i);
      AsyncStorage.setItem(CART_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    saveCart([]);
  }, [saveCart]);

  const placeOrder = useCallback(async (name: string, address: string, phone: string): Promise<Order> => {
    const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
    const order: Order = {
      id: `order_${Date.now()}`,
      items: [...items],
      total: subtotal + deliveryFeeFor(subtotal),
      name,
      address,
      phone,
      placedAt: new Date().toISOString(),
      status: "placed",
    };
    const nextOrders = [order, ...orders];
    setOrders(nextOrders);
    try {
      await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(nextOrders));
    } catch {}
    saveCart([]);
    return order;
  }, [items, orders, saveCart]);

  const totalItems = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const totalPrice = useMemo(
    () => items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
    [items],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      loaded,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      totalItems,
      totalPrice,
      orders,
      placeOrder,
    }),
    [items, loaded, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice, orders, placeOrder],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}
