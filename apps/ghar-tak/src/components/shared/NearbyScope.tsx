import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

/** The line under a list's title that switches between "near me" and "all". */
export function NearbyScopeSwitch({ path, showAll }: { path: string; showAll: boolean }) {
  return (
    <p className="text-sm text-muted-foreground">
      {showAll ? 'Showing all, near and far. ' : 'Showing only those that reach your location. '}
      <Link href={showAll ? path : `${path}?view=all`} className="text-primary hover:underline">
        {showAll ? 'Show only those near me' : 'Show all'}
      </Link>
    </p>
  );
}

/** What a "near me" list shows when nothing reaches the customer. */
export function NoneNearby({ message, allHref, allLabel }: { message: string; allHref: string; allLabel: string }) {
  return (
    <div className="text-center py-10 space-y-4">
      <p className="text-muted-foreground">{message}</p>
      <Button asChild variant="outline">
        <Link href={allHref}>{allLabel}</Link>
      </Button>
    </div>
  );
}
