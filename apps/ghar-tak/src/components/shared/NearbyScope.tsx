import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { useLocationChooser } from '@/components/shared/LocationChooser';
import { useLocation } from '@/hooks/useLocation';

/**
 * The line under a list's title that switches between "near me" and "all". With an
 * approximate location there is nothing to switch: everything is listed, nearest first,
 * and the customer is asked to pin their location.
 */
export function NearbyScopeSwitch({ path, showAll, approximate = false }: { path: string; showAll: boolean; approximate?: boolean }) {
  const { place } = useLocation();
  const { openLocationChooser } = useLocationChooser();
  if (approximate) {
    return (
      <p className="text-sm text-amber-700 dark:text-amber-400">
        {place
          ? `You picked ${place}, so everything is shown, nearest first. `
          : 'Your location is only approximate, so everything is shown, nearest first. '}
        <button type="button" onClick={openLocationChooser} className="text-primary hover:underline">
          Pin your location
        </button>{' '}
        to see the ones that reach you.
      </p>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      {showAll ? 'Showing all, near and far. ' : 'Showing only those that reach your location. '}
      <Link href={showAll ? path : `${path}?view=all`} className="text-primary hover:underline">
        {showAll ? 'Show only those near me' : 'Show all'}
      </Link>
      {' · '}
      <button type="button" onClick={openLocationChooser} className="text-primary hover:underline">
        Change location
      </button>
    </p>
  );
}

/** What a "near me" list shows when nothing reaches the customer. */
export function NoneNearby({ message, allHref, allLabel }: { message: string; allHref: string; allLabel: string }) {
  const { openLocationChooser } = useLocationChooser();
  return (
    <div className="text-center py-10 space-y-4">
      <p className="text-muted-foreground">{message}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild variant="outline">
          <Link href={allHref}>{allLabel}</Link>
        </Button>
        <Button variant="ghost" onClick={openLocationChooser}>Change my location</Button>
      </div>
    </div>
  );
}
