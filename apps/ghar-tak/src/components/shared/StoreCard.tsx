import { Link } from 'wouter';
import { Provider } from '@workspace/api-client-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, MapPin, Star, Clock, Navigation } from 'lucide-react';
import { useFavorites } from '@/hooks/useFavorites';
import { formatDistance } from '@workspace/geo';

interface StoreCardProps {
  store: Provider;
  distanceKm?: number | null;
}

export default function StoreCard({ store, distanceKm }: StoreCardProps) {
  const { favouriteIds, toggleFavourite } = useFavorites();
  const isFav = favouriteIds.has(store.id);

  return (
    <Card className="w-full overflow-hidden transition-all hover:shadow-lg">
      <CardHeader className="p-0">
        <Link href={`/stores/${store.id}`} className="block">
          <div className="aspect-[16/9] relative w-full">
            <img
              src={store.coverUrl || store.avatarUrl || `https://placehold.co/600x400.png?text=${encodeURIComponent(store.name)}`}
              alt={store.name}
              className="w-full h-full object-cover"
            />
          </div>
        </Link>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <Link href={`/stores/${store.id}`}>
            <CardTitle className="text-lg font-headline hover:text-primary transition-colors">{store.name}</CardTitle>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleFavourite(store.id)}
            className={isFav ? 'text-destructive' : 'text-muted-foreground hover:text-destructive'}
            aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
          >
            <Heart className={`h-5 w-5 ${isFav ? 'fill-destructive' : ''}`} />
            <span className="sr-only">Favorite</span>
          </Button>
        </div>
        <CardDescription className="text-sm text-muted-foreground mb-1 line-clamp-2">
          {store.description || `Explore a wide range of products at ${store.name}.`}
        </CardDescription>
        <Badge variant="secondary" className="mb-2">{store.category || 'General'}</Badge>

        <div className="flex items-center text-xs text-muted-foreground mb-1">
          <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
          <span>{store.address || 'Unknown location'}</span>
        </div>

        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          {typeof distanceKm === 'number' && (
            <div className="flex items-center">
              <Navigation className="h-3 w-3 mr-1" />
              <span>{formatDistance(distanceKm)} away</span>
            </div>
          )}
          {store.rating > 0 && (
            <div className="flex items-center">
              <Star className="h-3 w-3 mr-1 text-yellow-500 fill-yellow-500" />
              <span>{Number(store.rating ?? 0).toFixed(1)}</span>
            </div>
          )}
          {store.deliveryRadius && (
            <div className="flex items-center">
              <Clock className="h-3 w-3 mr-1" />
              <span>{store.deliveryRadius} delivery</span>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="p-4 border-t">
        <Button asChild variant="outline" className="w-full">
          <Link href={`/stores/${store.id}`}>View Store</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
