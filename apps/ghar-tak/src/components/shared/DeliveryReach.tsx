import { Navigation } from 'lucide-react';
import type { Provider } from '@workspace/api-client-react';
import { deliveryReach, formatDistance } from '@workspace/geo';
import { useLocationChooser } from '@/components/shared/LocationChooser';
import { useLocation } from '@/hooks/useLocation';
import { useNearbyFilter } from '@/hooks/useNearby';

/**
 * "2.3 km away · delivers to your location", or that the customer is outside its area.
 * With an approximate location it says so instead of guessing either way.
 */
export default function DeliveryReach({ provider, className = '' }: { provider: Provider; className?: string }) {
  const { point, approximate } = useNearbyFilter();
  const { place } = useLocation();
  const { openLocationChooser } = useLocationChooser();
  const reach = deliveryReach(point, provider);
  if (!reach) return null;

  const isService = provider.type === 'service';

  if (approximate) {
    return (
      <div className={`flex items-center text-muted-foreground ${className}`}>
        <Navigation className="h-4 w-4 mr-2 flex-shrink-0" />
        <span>
          About {formatDistance(reach.distanceKm)} away · {place ? `you picked ${place}` : 'your location is approximate'}.{' '}
          <button type="button" onClick={openLocationChooser} className="text-primary hover:underline">
            Pin your location
          </button>{' '}
          to check {isService ? 'if it serves you' : 'delivery'}.
        </span>
      </div>
    );
  }

  // The distance is rounded for display, so one a little past the edge can read as equal to the radius.
  const justOutside = reach.distanceKm - reach.radiusKm < 0.1;
  const verdict = reach.reaches
    ? isService ? 'serves your location' : 'delivers to your location'
    : `${justOutside ? 'just outside' : 'outside'} its ${reach.radiusKm} km ${isService ? 'service' : 'delivery'} area`;

  return (
    <div
      className={`flex items-center ${reach.reaches ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'} ${className}`}
    >
      <Navigation className="h-4 w-4 mr-2 flex-shrink-0" />
      <span>
        {formatDistance(reach.distanceKm)} away · {verdict}
      </span>
    </div>
  );
}
