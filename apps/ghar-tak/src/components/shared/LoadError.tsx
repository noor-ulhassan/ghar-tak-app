import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * What a list shows when it could not be loaded. A failed request says nothing about which
 * shops reach the customer, so it must not read like an empty "near me" list.
 */
export default function LoadError({ what, retrying, onRetry }: { what: string; retrying: boolean; onRetry: () => void }) {
  return (
    <div role="alert" className="text-center py-10 space-y-4">
      <p className="text-muted-foreground">We couldn't load the {what}. Check your connection and try again.</p>
      {/* A failed list stays failed while it is asked again (with its own retries), so show that it is trying. */}
      <Button variant="outline" onClick={onRetry} disabled={retrying}>
        {retrying && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
        {retrying ? 'Trying again…' : 'Try again'}
      </Button>
    </div>
  );
}
