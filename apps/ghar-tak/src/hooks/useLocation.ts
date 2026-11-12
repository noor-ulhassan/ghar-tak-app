import { useState, useEffect, useCallback } from 'react';
import type { Coords } from '@workspace/geo';
import type { Location } from '@/lib/types';

const STORAGE_KEY = 'ghar-tak:user-location';
const LOCATION_EVENT = 'ghar-tak:location-change';

/** Where the location came from: the device (GPS or Wi-Fi), or a spot the customer pinned on the map. */
export type LocationSource = 'device' | 'chosen';

interface Saved {
  location: Location;
  source: LocationSource;
  /** How far off a device reading may be, in metres, as the browser reports it. */
  accuracyM: number | null;
  savedAt: number;
}

// After a day a device location may be out of date (the customer moved), so it is refreshed.
// A spot the customer pinned stays until they change it.
const MAX_DEVICE_LOCATION_AGE_MS = 24 * 60 * 60 * 1000;
// Device readings vaguer than this (usually a computer locating itself by its internet
// connection) are flagged so the customer can pin the right spot.
export const ROUGH_ACCURACY_M = 2000;

const LABELS: Record<LocationSource, string> = {
  device: 'Your current location',
  chosen: 'Your pinned location',
};

interface UseLocationReturn {
  location: Location | null;
  source: LocationSource | null;
  accuracyM: number | null;
  error: string | null;
  loading: boolean;
  hasRealLocation: boolean;
  /**
   * Saves the location the customer picked in the location dialog. A device reading they
   * kept as it was (pass its accuracy) stays a device location: it refreshes daily and is
   * flagged when vague. Anything else is a pinned spot.
   */
  chooseLocation: (point: Coords, deviceAccuracyM?: number) => void;
}

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Location> & { savedAt?: number; source?: string; accuracyM?: number };
    if (typeof parsed.lat !== 'number' || typeof parsed.lng !== 'number') return null;
    // Locations saved before pinning existed all came from the device.
    const source: LocationSource = parsed.source === 'chosen' ? 'chosen' : 'device';
    return {
      location: { lat: parsed.lat, lng: parsed.lng, address: LABELS[source] },
      source,
      accuracyM: typeof parsed.accuracyM === 'number' ? parsed.accuracyM : null,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
    };
  } catch {
    return null;
  }
}

let saved: Saved | null = readSaved();
let pendingRequest: Promise<Saved | null> | null = null;

function announce() {
  window.dispatchEvent(new CustomEvent<Saved | null>(LOCATION_EVENT, { detail: saved }));
}

function save(location: Coords, source: LocationSource, accuracyM: number | null) {
  saved = { location: { ...location, address: LABELS[source] }, source, accuracyM, savedAt: Date.now() };
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ lat: location.lat, lng: location.lng, source, accuracyM, savedAt: saved.savedAt }),
    );
  } catch {
    // Storage can be unavailable (private mode, quota) — the in-memory copy still works.
  }
  announce();
}

// Another tab saved or cleared the location: use the same one here.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    saved = readSaved();
    announce();
  });
}

/**
 * Asks the browser where the device is; one request is shared by every caller. It never
 * replaces a spot the customer pinned, even one pinned in another tab meanwhile.
 */
function requestDeviceLocation(): Promise<Saved | null> {
  if (pendingRequest) return pendingRequest;

  pendingRequest = new Promise<Saved | null>((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        saved = readSaved() ?? saved;
        if (saved?.source === 'chosen') {
          announce();
          resolve(saved);
          return;
        }
        save(
          { lat: position.coords.latitude, lng: position.coords.longitude },
          'device',
          Math.round(position.coords.accuracy),
        );
        resolve(saved);
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  }).finally(() => {
    pendingRequest = null;
  });

  return pendingRequest;
}

export function useLocation(): UseLocationReturn {
  const [current, setCurrent] = useState<Saved | null>(saved);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(saved === null);

  const chooseLocation = useCallback((point: Coords, deviceAccuracyM?: number) => {
    if (deviceAccuracyM === undefined) save(point, 'chosen', null);
    else save(point, 'device', deviceAccuracyM);
  }, []);

  useEffect(() => {
    const onLocationChange = (event: Event) => {
      setCurrent((event as CustomEvent<Saved | null>).detail);
      setError(null);
      setLoading(false);
    };

    window.addEventListener(LOCATION_EVENT, onLocationChange);
    if (!saved) {
      requestDeviceLocation().then((result) => {
        if (!result) setError('Could not get your location.');
        setLoading(false);
      });
    } else if (saved.source === 'device' && Date.now() - saved.savedAt > MAX_DEVICE_LOCATION_AGE_MS) {
      // Refresh quietly: the old location stays on screen, and stays if the refresh fails.
      void requestDeviceLocation();
    }

    return () => window.removeEventListener(LOCATION_EVENT, onLocationChange);
  }, []);

  return {
    location: current?.location ?? null,
    source: current?.source ?? null,
    accuracyM: current?.accuracyM ?? null,
    error,
    loading,
    hasRealLocation: current !== null,
    chooseLocation,
  };
}
