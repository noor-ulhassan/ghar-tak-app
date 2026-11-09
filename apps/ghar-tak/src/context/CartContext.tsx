import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { Product } from '@workspace/api-client-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface CartItem {
  product: Product;
  quantity: number;
}

/**
 * 'added'   — the items are in the cart.
 * 'confirm' — the cart holds another store's items; the customer is asked before it is replaced.
 * 'limit'   — the store doesn't have that many; the cart was filled up to the stock.
 * 'none'    — nothing could be added: it's out of stock, or the cart already holds all of it.
 */
export type AddResult = 'added' | 'confirm' | 'limit' | 'none';

interface CartContextType {
  items: CartItem[];
  providerId: string | null;
  providerName: string | null;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (product: Product, providerId: string, providerName: string) => AddResult;
  addItems: (items: CartItem[], providerId: string, providerName: string) => AddResult;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

type Cart = { items: CartItem[]; providerId: string | null; providerName: string | null };

const EMPTY_CART: Cart = { items: [], providerId: null, providerName: null };
const STORAGE_KEY = 'ghar_tak_cart';

// The cart is kept in the browser so a page refresh doesn't empty it.
function loadCart(): Cart {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Cart;
      if (Array.isArray(saved.items) && saved.items.length > 0 && saved.providerId) return saved;
    }
  } catch { /* ignore */ }
  return EMPTY_CART;
}

function saveCart(cart: Cart) {
  try {
    if (cart.items.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

function withinStock(product: Product, quantity: number) {
  return Math.min(quantity, Math.max(product.stock, 0));
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCartState] = useState<Cart>(loadCart);
  const [isOpen, setIsOpen] = useState(false);
  // Another store's items waiting for the customer to agree to replace the cart.
  const [pending, setPending] = useState<Cart | null>(null);

  // Two quick clicks must both count, so changes build on the latest cart, not the last render.
  const cartRef = useRef(cart);
  const setCart = useCallback((next: Cart) => {
    cartRef.current = next;
    setCartState(next);
  }, []);

  useEffect(() => saveCart(cart), [cart]);

  // Another tab changed the saved cart: take its version, so neither tab overwrites the other.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) setCart(loadCart());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [setCart]);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const addItems = useCallback(
    (newItems: CartItem[], newProviderId: string, newProviderName: string): AddResult => {
      const current = cartRef.current;
      let limited = false;

      if (current.items.length > 0 && current.providerId !== newProviderId) {
        const replacement = newItems
          .map((item) => {
            const quantity = withinStock(item.product, item.quantity);
            if (quantity < item.quantity) limited = true;
            return { product: item.product, quantity };
          })
          .filter((item) => item.quantity > 0);
        if (replacement.length === 0) return 'none';
        setPending({ items: replacement, providerId: newProviderId, providerName: newProviderName });
        return 'confirm';
      }

      const merged = current.items.map((item) => ({ ...item }));
      let addedAny = false;
      for (const item of newItems) {
        const index = merged.findIndex((i) => i.product.id === item.product.id);
        const before = index >= 0 ? merged[index].quantity : 0;
        const wanted = before + item.quantity;
        const allowed = withinStock(item.product, wanted);
        if (allowed < wanted) limited = true;
        if (allowed > before) addedAny = true;
        if (index >= 0) {
          // Keep the newest product details so the drawer's "+" uses today's stock;
          // a product that is now out of stock leaves the cart.
          if (allowed > 0) merged[index] = { product: item.product, quantity: allowed };
          else merged.splice(index, 1);
        } else if (allowed > 0) {
          merged.push({ product: item.product, quantity: allowed });
        }
      }

      setCart(merged.length > 0 ? { items: merged, providerId: newProviderId, providerName: newProviderName } : EMPTY_CART);
      if (!addedAny) return 'none';
      return limited ? 'limit' : 'added';
    },
    [setCart]
  );

  const addItem = useCallback(
    (product: Product, newProviderId: string, newProviderName: string): AddResult =>
      addItems([{ product, quantity: 1 }], newProviderId, newProviderName),
    [addItems]
  );

  const confirmReplace = useCallback(() => {
    if (pending) {
      setCart(pending);
      setIsOpen(true);
    }
    setPending(null);
  }, [pending, setCart]);

  const removeItem = useCallback(
    (productId: string) => {
      const items = cartRef.current.items.filter((i) => i.product.id !== productId);
      setCart(items.length > 0 ? { ...cartRef.current, items } : EMPTY_CART);
    },
    [setCart]
  );

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(productId);
        return;
      }
      setCart({
        ...cartRef.current,
        items: cartRef.current.items.map((i) =>
          i.product.id === productId ? { ...i, quantity: withinStock(i.product, quantity) } : i
        ),
      });
    },
    [removeItem, setCart]
  );

  const clearCart = useCallback(() => setCart(EMPTY_CART), [setCart]);

  const { items, providerId, providerName } = cart;
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        providerId,
        providerName,
        isOpen,
        openCart,
        closeCart,
        addItem,
        addItems,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
      }}
    >
      {children}
      <AlertDialog open={!!pending} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new cart?</AlertDialogTitle>
            <AlertDialogDescription>
              Your cart has items from {providerName ?? 'another store'}. An order can only come from one
              store, so adding from {pending?.providerName ?? 'this store'} will remove them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my cart</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReplace}>Start new cart</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
