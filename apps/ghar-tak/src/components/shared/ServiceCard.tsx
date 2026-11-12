import { Link } from 'wouter';
import { Provider } from '@workspace/api-client-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Star, CalendarClock, Heart, Navigation, BadgeCheck } from 'lucide-react';
import { formatDistance } from '@workspace/geo';
import { useFavorites } from '@/hooks/useFavorites';

interface ServiceCardProps {
  serviceProvider: Provider;
  distanceKm?: number | null;
}

export default function ServiceCard({ serviceProvider, distanceKm }: ServiceCardProps) {
  const { favouriteIds, toggleFavourite } = useFavorites();
  const isFavorite = favouriteIds.has(serviceProvider.id);

  return (
    <Card className="w-full overflow-hidden transition-all hover:shadow-lg flex flex-col">
      <CardHeader className="p-0">
        <Link href={`/services/${serviceProvider.category || 'all'}/${serviceProvider.id}`} className="block">
          <div className="aspect-[16/9] relative w-full">
            <img
              src={serviceProvider.coverUrl || serviceProvider.avatarUrl || `https://placehold.co/600x400.png?text=${encodeURIComponent(serviceProvider.name)}`}
              alt={serviceProvider.name}
              className="w-full h-full object-cover"
            />
          </div>
        </Link>
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        <div className="flex justify-between items-start mb-2">
          <Link href={`/services/${serviceProvider.category || 'all'}/${serviceProvider.id}`}>
            <CardTitle className="text-lg font-headline hover:text-primary transition-colors line-clamp-1 flex items-center gap-1">
              {serviceProvider.name}
              {serviceProvider.isVerified && <BadgeCheck className="h-4 w-4 text-primary flex-shrink-0" aria-label="Verified provider" />}
            </CardTitle>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleFavourite(serviceProvider.id)}
            className="text-muted-foreground hover:text-destructive flex-shrink-0"
            aria-label={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
          >
            <Heart className={`h-5 w-5 ${isFavorite ? 'fill-destructive text-destructive' : ''}`} />
            <span className="sr-only">Favorite</span>
          </Button>
        </div>
        <CardDescription className="text-sm text-muted-foreground mb-1 line-clamp-2 h-10">
          {serviceProvider.description || `Professional services.`}
        </CardDescription>
        <Badge variant="secondary" className="mb-2">{serviceProvider.category || 'Service'}</Badge>
        
        <div className="space-y-1 text-xs text-muted-foreground mt-2">
          <div className="flex items-center">
            <MapPin className="h-3 w-3 mr-1.5 flex-shrink-0" />
            <span className="truncate">{serviceProvider.address || 'Service area varies'}</span>
          </div>
          {typeof distanceKm === 'number' && (
            <div className="flex items-center">
              <Navigation className="h-3 w-3 mr-1.5 flex-shrink-0" />
              <span>{formatDistance(distanceKm)} away</span>
            </div>
          )}
          <div className="flex items-center">
            <CalendarClock className="h-3 w-3 mr-1.5 flex-shrink-0" />
            <span>{serviceProvider.openingHours || 'Contact for availability'}</span>
          </div>
          {serviceProvider.rating > 0 && (
            <div className="flex items-center">
              <Star className="h-3 w-3 mr-1.5 text-yellow-500 fill-yellow-500 flex-shrink-0" />
              <span>{Number(serviceProvider.rating ?? 0).toFixed(1)} rating</span>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="p-4 border-t mt-auto">
        <Button asChild variant="default" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
          <Link href={`/services/${serviceProvider.category || 'all'}/${serviceProvider.id}`}>Book Service</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
