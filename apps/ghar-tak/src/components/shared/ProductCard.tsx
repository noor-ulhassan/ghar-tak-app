import { Link } from 'wouter';
import { Product } from '@workspace/api-client-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Minus, Plus } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';

interface ProductCardProps {
  product: Product;
  /** Provider context — required to add to cart */
  providerId?: string;
  providerName?: string;
  /** When set, clicking the image opens the detail view instead of navigating */
  onSelect?: (product: Product) => void;
}

export default function ProductCard({ product, providerId, providerName, onSelect }: ProductCardProps) {
  const { addItem, updateQuantity, removeItem, items, openCart } = useCart();
  const { toast } = useToast();

  const cartItem = items.find((i) => i.product.id === product.id);
  const quantity = cartItem?.quantity ?? 0;
  const stock = product.stock ?? 0;

  function handleAdd() {
    if (!providerId) return;
    const result = addItem(product, providerId, providerName ?? 'Store');
    if (result === 'limit') {
      toast({ title: 'Not enough stock', description: `${product.name} is out of stock.` });
    } else if (result === 'added') {
      openCart();
    }
  }

  return (
    <Card className="w-full overflow-hidden transition-all hover:shadow-lg flex flex-col">
      <CardHeader className="p-0">
        {onSelect ? (
          <div className="aspect-square relative w-full cursor-pointer" onClick={() => onSelect(product)}>
            <img
              src={product.imageUrl || `https://placehold.co/300x300.png?text=${encodeURIComponent(product.name)}`}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <Link href={providerId ? `/stores/${providerId}` : '#'}>
            <div className="aspect-square relative w-full cursor-pointer">
              <img
                src={product.imageUrl || `https://placehold.co/300x300.png?text=${encodeURIComponent(product.name)}`}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
          </Link>
        )}
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        <CardTitle className="text-lg font-headline mb-1 line-clamp-2 h-14">{product.name}</CardTitle>
        {product.category && <Badge variant="outline" className="text-xs mb-2">{product.category}</Badge>}
        <p className="text-lg font-semibold text-primary">PKR {Number(product.price ?? 0).toFixed(2)}</p>
      </CardContent>
      <CardFooter className="p-4 border-t">
        {!providerId ? (
          <Button variant="default" className="w-full" disabled>
            <ShoppingCart className="mr-2 h-4 w-4" /> Add to Cart
          </Button>
        ) : stock <= 0 && quantity === 0 ? (
          <Button variant="default" className="w-full" disabled>
            Out of Stock
          </Button>
        ) : quantity === 0 ? (
          <Button variant="default" className="w-full" onClick={handleAdd}>
            <ShoppingCart className="mr-2 h-4 w-4" /> Add to Cart
          </Button>
        ) : (
          <div className="flex items-center justify-between w-full gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => updateQuantity(product.id, quantity - 1)}
              aria-label="Decrease quantity"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button variant="secondary" className="flex-1" onClick={openCart}>
              {quantity} in cart
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => updateQuantity(product.id, quantity + 1)}
              disabled={quantity >= stock}
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
