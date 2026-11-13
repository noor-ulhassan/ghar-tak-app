import { useMemo } from "react";
import { isApproximate, type Coords } from "@workspace/geo";
import { useLocation } from "@/hooks/useLocation";

// About 11 m: a GPS reading that moves a little keeps the same lists.
const round = (value: number) => Math.round(value * 1e4) / 1e4;

/** Where the customer is, for distances. Null until a location is known, however rough. */
export function useCustomerPoint(): Coords | null {
  const { location, hasRealLocation } = useLocation();
  const lat = hasRealLocation && location ? round(location.lat) : null;
  const lng = hasRealLocation && location ? round(location.lng) : null;
  return useMemo(() => (lat === null || lng === null ? null : { lat, lng }), [lat, lng]);
}

/**
 * Whether the "near me" lists can filter by the customer's location. An approximate one (a
 * device locating itself by its internet connection can be 30 km off, or a picked city) would
 * hide shops that do deliver and show ones that don't, so then the lists show every shop,
 * nearest first, and ask the customer to pin their location instead.
 *
 * `point` is for distances and sorting; `filterPoint` is what to filter by, or null.
 */
export function useNearbyFilter() {
  const point = useCustomerPoint();
  const { accuracyM } = useLocation();
  const approximate = point !== null && isApproximate(accuracyM);
  return { point, filterPoint: approximate ? null : point, approximate };
}
