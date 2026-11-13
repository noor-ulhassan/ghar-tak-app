import { useEffect, useSyncExternalStore } from 'react';
import type { Coords } from '@workspace/geo';
import type { Location } from '@/lib/types';

const STORAGE_KEY = 'ghar-tak:user-location';

/** Where the location came from: the device (GPS or Wi-Fi), or a spot the customer pinned on the map. */
export type LocationSource = 'device' | 'chosen';

interface Saved {
  location: Location;
  source: LocationSource;
  /** How far off the location may be, in metres: as the browser reports it, or set for a picked city. */
  accuracyM: number | null;
  /** The city the customer picked, when they picked a city rather than a spot. */
  place: string | null;
  savedAt: number;
}

/** locating: the first device request is still open. ready: a location is known. failed: none is known. */
type LocationStatus = 'locating' | 'ready' | 'failed';

interface LocationState {
  saved: Saved | null;
  status: LocationStatus;
  error: string | null;
}

// After a day a device location may be out of date (the customer moved), so it is refreshed.
// A spot the customer pinned stays until they change it.
const MAX_DEVICE_LOCATION_AGE_MS = 24 * 60 * 60 * 1000;
// The browser's own timeout doesn't count the time its permission prompt stays open, so a
// customer who ignores the prompt would wait forever. After this the location counts as
// unknown; an answer that comes later is still used.
const PROMPT_WAIT_MS = 10000;
const NO_LOCATION = 'Could not get your location.';

const LABELS: Record<LocationSource, string> = {
  device: 'Your current location',
  chosen: 'Your pinned location',
};

/**
 * How the customer got the location they save in the location dialog. A device reading they
 * kept as it was stays a device location: it refreshes daily and is flagged when vague.
 * Anything else is a chosen spot, or a city when `place` is given.
 */
type ChooseHow =
  | { source: 'device'; accuracyM: number }
  | { source: 'chosen'; accuracyM?: number | null; place?: string };

interface UseLocationReturn {
  location: Location | null;
  source: LocationSource | null;
  accuracyM: number | null;
  place: string | null;
  error: string | null;
  loading: boolean;
  hasRealLocation: boolean;
  chooseLocation: (point: Coords, how: ChooseHow) => void;
}

const inRange = (value: unknown, limit: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    const lat = parsed?.lat;
    const lng = parsed?.lng;
    const source = parsed?.source;
    // Out of range, the server would refuse every list asked for with it.
    if (!inRange(lat, 90) || !inRange(lng, 180)) return null;
    // Locations saved before pinning existed have no source. They were often a laptop
    // guessing from its internet connection, so the device is asked again instead.
    if (source !== 'device' && source !== 'chosen') return null;
    return {
      location: { lat, lng, address: LABELS[source] },
      source,
      accuracyM: typeof parsed?.accuracyM === 'number' && Number.isFinite(parsed.accuracyM) ? parsed.accuracyM : null,
      place: typeof parsed?.place === 'string' && parsed.place ? parsed.place : null,
      savedAt: typeof parsed?.savedAt === 'number' ? parsed.savedAt : 0,
    };
  } catch {
    return null;
  }
}

// One state for every component, so they all show the same location at the same moment.
const initial = readSaved();
let state: LocationState = { saved: initial, status: initial ? 'ready' : 'locating', error: null };
const listeners = new Set<() => void>();

function setState(next: Partial<LocationState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;

function save(point: Coords, source: LocationSource, accuracyM: number | null, place: string | null) {
  const saved: Saved = {
    location: { lat: point.lat, lng: point.lng, address: LABELS[source] },
    source,
    accuracyM,
    place,
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ lat: point.lat, lng: point.lng, source, accuracyM, ...(place ? { place } : {}), savedAt: saved.savedAt }),
    );
  } catch {
    // Storage can be unavailable (private mode, quota) — the in-memory copy still works.
  }
  setState({ saved, status: 'ready', error: null });
}

function chooseLocation(point: Coords, how: ChooseHow) {
  save(point, how.source, how.accuracyM ?? null, how.source === 'chosen' ? (how.place ?? null) : null);
}

// Another tab saved or cleared the location: use the same one here.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    const saved = readSaved();
    setState(
      saved
        ? { saved, status: 'ready', error: null }
        : { saved: null, status: state.status === 'locating' ? 'locating' : 'failed' },
    );
  });
}

/** Asks the browser where the device is. It never replaces a spot the customer pinned. */
function requestDeviceLocation() {
  const waiting = !state.saved;
  if (!navigator.geolocation) {
    if (waiting) setState({ status: 'failed', error: NO_LOCATION });
    return;
  }
  if (waiting) setState({ status: 'locating', error: null });
  const giveUp = waiting
    ? setTimeout(() => {
        if (state.status === 'locating') setState({ status: 'failed', error: NO_LOCATION });
      }, PROMPT_WAIT_MS)
    : undefined;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      clearTimeout(giveUp);
      // A spot pinned meanwhile, here or in another tab, wins over the device.
      const pinned = [readSaved(), state.saved].find((saved) => saved?.source === 'chosen');
      if (pinned) {
        setState({ saved: pinned, status: 'ready', error: null });
        return;
      }
      save(
        { lat: position.coords.latitude, lng: position.coords.longitude },
        'device',
        Math.round(position.coords.accuracy),
        null,
      );
    },
    () => {
      clearTimeout(giveUp);
      // A refresh that fails keeps the old location on screen.
      if (!state.saved) setState({ status: 'failed', error: NO_LOCATION });
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
  );
}

// The device is asked by itself at most once per page session: a customer who ignored or
// refused the prompt isn't asked again on every page, and a stale reading is refreshed once.
// Only their own action (the location dialog) asks again after that.
let askedAutomatically = false;

function locateAutomatically() {
  if (askedAutomatically) return;
  const { saved } = state;
  const stale = saved?.source === 'device' && Date.now() - saved.savedAt > MAX_DEVICE_LOCATION_AGE_MS;
  if (saved && !stale) return;
  askedAutomatically = true;
  requestDeviceLocation();
}

export function useLocation(): UseLocationReturn {
  const { saved, status, error } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(locateAutomatically, []);

  return {
    location: saved?.location ?? null,
    source: saved?.source ?? null,
    accuracyM: saved?.accuracyM ?? null,
    place: saved?.place ?? null,
    error,
    loading: status === 'locating',
    hasRealLocation: saved !== null,
    chooseLocation,
  };
}
