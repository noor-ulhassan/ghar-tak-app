import { Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocationChooser } from '@/components/shared/LocationChooser';
import { isApproximate, useLocation } from '@/hooks/useLocation';

/** The home page line that says which location the lists are for, with a way to change it. */
export default function LocationDisplay() {
  const { location, source, accuracyM, place, loading } = useLocation();
  const { openLocationChooser } = useLocationChooser();

  const rough = location !== null && isApproximate(accuracyM);
  // Rounded up: "within about 2 km" would claim the precision the lists treat as exact.
  const roughKm = rough && accuracyM !== null ? Math.ceil(accuracyM / 1000) : null;
  const message = !location
    ? loading
      ? 'Finding your location…'
      : "We don't know where you are, so every shop is shown. Set your location to see the ones that deliver to you."
    : rough
      ? place
        ? `Showing every shop, nearest to ${place} first. Pin your street to see the ones that deliver to you.`
        : `Your location is only approximate (within about ${roughKm} km), so every shop is shown, nearest first. Pin your location to see the ones that deliver to you.`
      : source === 'chosen'
        ? 'Showing the shops that deliver to the spot you pinned.'
        : 'Showing the shops that deliver to your current location.';

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg shadow-sm border bg-card">
      {loading && !location ? (
        <Loader2 className="h-5 w-5 text-primary flex-shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        <MapPin className="h-5 w-5 text-primary flex-shrink-0" aria-hidden="true" />
      )}
      <span aria-live="polite" className={(!location && !loading) || rough ? 'text-amber-700 dark:text-amber-400' : undefined}>
        {message}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={openLocationChooser}
        className="text-primary hover:text-primary/80"
        aria-label={location && !rough ? 'Change location' : undefined}
      >
        {!location ? 'Set your location' : rough ? 'Pin your location' : 'Change'}
      </Button>
    </div>
  );
}
