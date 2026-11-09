import { useCart } from '@/context/CartContext';
import { useUser } from '@clerk/react';
import { useLocation } from 'wouter';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Minus, Plus, Trash2, ShoppingCart, ArrowRight } from 'lucide-react';

export default function CartDrawer() {
  const { items, providerName, isOpen, closeCart, removeItem, updateQuantity, totalPrice, totalItems } = useCart();
  const { user } = useUser();
  const [, navigate] = useLocation();

  function handleCheckout() {
    closeCart();
    navigate(user ? '/checkout' : '/sign-in');
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) closeCart(); }}>
      <SheetContent className="flex flex-col w-full sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Your Cart
            {totalItems > 0 && (
              <Badge className="ml-1">{totalItems}</Badge>
            )}
          </SheetTitle>
          {providerName && (
            <p className="text-sm text-muted-foreground">From: <span className="font-medium text-foreground">{providerName}</span></p>
          )}
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center py-12">
            <ShoppingCart className="h-16 w-16 text-muted-foreground/40" />
            <h3 className="text-lg font-medium text-muted-foreground">Your cart is empty</h3>
            <p className="text-sm text-muted-foreground">Add products from a store to get started.</p>
            <Button variant="outline" onClick={closeCart}>Continue Shopping</Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-3 py-2">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="flex items-center gap-3 bg-muted/40 rounded-lg p-3">
                  <img
                    src={product.imageUrl || `https://placehold.co/56x56.png?text=${encodeURIComponent(product.name[0])}`}
                    alt={product.name}
                    className="w-14 h-14 object-cover rounded-md flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm leading-tight line-clamp-2">{product.name}</p>
                    <p className="text-primary text-sm font-semibold mt-0.5">PKR {product.price.toFixed(2)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => updateQuantity(product.id, quantity - 1)}
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium">{quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => updateQuantity(product.id, quantity + 1)}
                        disabled={quantity >= product.stock}
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => removeItem(product.id)}
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-3 py-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span className="text-foreground">PKR {totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Delivery & discounts</span>
                <span>Calculated at checkout</span>
              </div>
              <div className="flex justify-between text-base font-semibold border-t pt-2">
                <span>Estimated Total</span>
                <span className="text-primary">PKR {totalPrice.toFixed(2)}</span>
              </div>
            </div>

            <SheetFooter className="pt-2">
              <Button className="w-full" size="lg" onClick={handleCheckout}>
                Proceed to Checkout <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
