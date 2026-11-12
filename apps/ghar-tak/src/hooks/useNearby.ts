import { useMemo } from 'react';
import { useSearch } from 'wouter';
import type { Coords } from '@workspace/geo';
import { useLocation } from '@/hooks/useLocation';

// About 11 m: a GPS reading that moves a little keeps using the same cached lists.
const round = (value: number) => Math.round(value * 1e4) / 1e4;

/** Where the customer is, for "near me" lists. Null until a real location is known. */
export function useCustomerPoint(): Coords | null {
  const { location, hasRealLocation } = useLocation();
  const lat = hasRealLocation && location ? round(location.lat) : null;
  const lng = hasRealLocation && location ? round(location.lng) : null;
  return useMemo(() => (lat === null || lng === null ? null : { lat, lng }), [lat, lng]);
}

/**
 * For pages with a "Show all" switch (?view=all). `filterPoint` is the point to ask the
 * server for, or null to list everything; `point` stays set so distances can still show.
 */
export function useNearbyScope() {
  const point = useCustomerPoint();
  const showAll = new URLSearchParams(useSearch()).get('view') === 'all';
  return { point, filterPoint: showAll ? null : point, showAll };
}
