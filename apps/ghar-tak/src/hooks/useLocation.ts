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
  /** Asks the device again; its answer replaces a pinned spot. */
  refetchLocation: () => void;
  /** Saves a spot the customer pinned on the map. */
  chooseLocation: (point: Coords) => void;
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
// Set when the customer asks for their device location while an automatic request is in flight.
let deviceRequestedByCustomer = false;

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
  window.dispatchEvent(new CustomEvent<Saved>(LOCATION_EVENT, { detail: saved }));
}

/**
 * Asks the browser where the device is. One request is shared by every caller. An automatic
 * request never replaces a spot the customer pinned; one the customer asked for does.
 */
function requestDeviceLocation(byCustomer: boolean): Promise<Saved | null> {
  if (byCustomer) deviceRequestedByCustomer = true;
  if (pendingRequest) return pendingRequest;

  pendingRequest = new Promise<Saved | null>((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (saved?.source === 'chosen' && !deviceRequestedByCustomer) {
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
    deviceRequestedByCustomer = false;
  });

  return pendingRequest;
}

export function useLocation(): UseLocationReturn {
  const [current, setCurrent] = useState<Saved | null>(saved);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(saved === null);

  const askDevice = useCallback(async (byCustomer: boolean) => {
    setLoading(true);
    setError(null);
    const result = await requestDeviceLocation(byCustomer);
    if (!result) {
      setError(saved ? 'Could not refresh your location. Still using your last one.' : 'Could not get your location.');
    }
    setLoading(false);
  }, []);

  const refetchLocation = useCallback(() => {
    void askDevice(true);
  }, [askDevice]);

  const chooseLocation = useCallback((point: Coords) => {
    save(point, 'chosen', null);
  }, []);

  useEffect(() => {
    const onLocationChange = (event: Event) => {
      const detail = (event as CustomEvent<Saved>).detail;
      if (!detail) return;
      setCurrent(detail);
      setError(null);
      setLoading(false);
    };

    window.addEventListener(LOCATION_EVENT, onLocationChange);
    if (!saved) {
      void askDevice(false);
    } else if (saved.source === 'device' && Date.now() - saved.savedAt > MAX_DEVICE_LOCATION_AGE_MS) {
      // Refresh quietly: the old location stays on screen, and stays if the refresh fails.
      void requestDeviceLocation(false);
    }

    return () => window.removeEventListener(LOCATION_EVENT, onLocationChange);
  }, [askDevice]);

  return {
    location: current?.location ?? null,
    source: current?.source ?? null,
    accuracyM: current?.accuracyM ?? null,
    error,
    loading,
    hasRealLocation: current !== null,
    refetchLocation,
    chooseLocation,
  };
}
