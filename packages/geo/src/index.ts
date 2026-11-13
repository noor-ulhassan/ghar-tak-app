export interface Coords {
  lat: number;
  lng: number;
}

export const EARTH_RADIUS_KM = 6371;

// A shop that hasn't set its delivery radius is treated as delivering this far.
export const DEFAULT_DELIVERY_RADIUS_KM = 5;
export const MIN_DELIVERY_RADIUS_KM = 0.5;
export const MAX_DELIVERY_RADIUS_KM = 50;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function distanceKm(from: Coords, to: Coords): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function formatDistance(km: number): string {
  const metres = Math.max(50, Math.round((km * 1000) / 50) * 50);
  if (metres < 1000) return `${metres} m`;
  // A tenth of a km means nothing for a shop in another city ("1033.0 km").
  const tenths = Math.round(km * 10) / 10;
  return tenths < 100 ? `${tenths.toFixed(1)} km` : `${Math.round(km)} km`;
}

interface Located {
  lat?: number | null;
  lng?: number | null;
}

export function providerDistance(origin: Coords | null, provider: Located): number | null {
  if (!origin || provider.lat == null || provider.lng == null) return null;
  return distanceKm(origin, { lat: provider.lat, lng: provider.lng });
}

interface Reaching extends Located {
  deliveryRadiusKm?: number | null;
}

/**
 * How far the provider is from `point` and whether its radius (or the default) reaches it,
 * the same rule the server's "near me" list uses. Null when either location is unknown.
 */
export function deliveryReach(point: Coords | null, provider: Reaching) {
  const km = providerDistance(point, provider);
  if (km === null) return null;
  const radiusKm = provider.deliveryRadiusKm ?? DEFAULT_DELIVERY_RADIUS_KM;
  return { distanceKm: km, radiusKm, reaches: km <= radiusKm };
}

export function sortByDistance<T extends Located>(items: T[], origin: Coords | null): T[] {
  if (!origin) return items;
  return [...items].sort((a, b) => {
    const da = providerDistance(origin, a) ?? Number.POSITIVE_INFINITY;
    const db = providerDistance(origin, b) ?? Number.POSITIVE_INFINITY;
    return da === db ? 0 : da - db;
  });
}

// Locations vaguer than this (a computer locating itself by its internet connection, or a
// picked city) are flagged so the customer can pin the right spot.
export const ROUGH_ACCURACY_M = 2000;

/** How vague a picked city counts as: enough to sort by, too vague to filter by. */
export const CITY_ACCURACY_M = 10000;

/** Whether a location is too vague to tell which shops reach it. Null (unknown) is not vague. */
export function isApproximate(accuracyM: number | null): boolean {
  return accuracyM !== null && accuracyM > ROUGH_ACCURACY_M;
}

/** City centres, so a customer can jump the map to their city before pinning their street. */
export const CITIES: (Coords & { name: string })[] = [
  { name: 'Lahore', lat: 31.5204, lng: 74.3587 },
  { name: 'Karachi', lat: 24.8607, lng: 67.0011 },
  { name: 'Islamabad', lat: 33.6844, lng: 73.0479 },
  { name: 'Rawalpindi', lat: 33.5651, lng: 73.0169 },
  { name: 'Faisalabad', lat: 31.4504, lng: 73.135 },
  { name: 'Multan', lat: 30.1575, lng: 71.5249 },
  { name: 'Peshawar', lat: 34.0151, lng: 71.5249 },
];
