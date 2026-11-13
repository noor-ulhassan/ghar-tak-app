import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import LocationChooser from '@/components/shared/LocationChooser';
import { ROUGH_ACCURACY_M, useLocation } from '@/hooks/useLocation';

/** The home page line that says which location the lists are for, with a way to change it. */
export default function LocationDisplay() {
  const { location, source, accuracyM, error, loading } = useLocation();
  const [choosing, setChoosing] = useState(false);

  if (loading && !location) {
    return (
      <div className="flex items-center space-x-2 text-sm text-muted-foreground p-2 rounded-lg bg-muted/50">
        <MapPin className="h-5 w-5 text-primary" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  const roughKm =
    source === 'device' && accuracyM !== null && accuracyM > ROUGH_ACCURACY_M ? Math.round(accuracyM / 1000) : null;
  const rough = roughKm !== null;
  const message = !location
    ? "We don't know where you are, so every shop is shown. Set your location to see the ones that deliver to you."
    : source === 'chosen'
      ? 'Showing the shops that deliver to the spot you pinned.'
      : rough
        ? `Your location is only approximate (within about ${roughKm} km), so every shop is shown, nearest first. Pin your location to see the ones that deliver to you.`
        : 'Showing the shops that deliver to your current location.';

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg shadow-sm border bg-card">
      <MapPin className="h-5 w-5 text-primary flex-shrink-0" />
      <span className={!location || rough ? 'text-amber-700 dark:text-amber-400' : undefined}>{message}</span>
      {error && location && <span className="text-xs">({error})</span>}
      <Button variant="ghost" size="sm" onClick={() => setChoosing(true)} className="text-primary hover:text-primary/80">
        {!location ? 'Set your location' : rough ? 'Pin your location' : 'Change'}
      </Button>
      <LocationChooser open={choosing} onOpenChange={setChoosing} />
    </div>
  );
}
