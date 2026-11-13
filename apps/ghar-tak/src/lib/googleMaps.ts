// Loads the Google Maps script once for the whole site and reports a rejected key to every
// map that asks, so the home map and the location picker never load it twice or overwrite
// each other's error handler.

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export const hasGoogleMapsKey = Boolean(API_KEY);

type MapsWindow = Window & { gm_authFailure?: () => void };

let loading: Promise<void> | null = null;
// Google rejects a key (wrong key, blocked site, no billing) once per page load.
let keyRejected = false;
// The script failed to load, or took too long, during this page session.
let loadFailed = false;
const rejectionListeners = new Set<() => void>();

export function loadGoogleMaps(): Promise<void> {
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    if (typeof window.google !== 'undefined' && window.google.maps) {
      resolve();
      return;
    }
    if (!API_KEY) {
      reject(new Error('VITE_GOOGLE_MAPS_API_KEY is not set'));
      return;
    }
    (window as MapsWindow).gm_authFailure = () => {
      keyRejected = true;
      rejectionListeners.forEach((listener) => listener());
    };
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    // The same address the home map always used, so its classes are ready when the script loads.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(API_KEY)}&libraries=places`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Taken out again so a retry doesn't leave several dead tags with the same id.
      script.remove();
      loadFailed = true;
      reject(new Error('Google Maps script failed to load'));
    };
    document.head.appendChild(script);
  });
  // A failed load can be retried on the next page that needs a map.
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

/** Calls `listener` if Google rejects the key, now or later. Returns a function that stops listening. */
export function onGoogleMapsKeyRejected(listener: () => void): () => void {
  if (keyRejected) {
    listener();
    return () => {};
  }
  rejectionListeners.add(listener);
  return () => rejectionListeners.delete(listener);
}

export function googleMapsKeyRejected(): boolean {
  return keyRejected;
}

/** A map that waited too long for Google gave up on it; later maps skip it for this page session. */
export function markGoogleMapsUnavailable(): void {
  loadFailed = true;
}

/** True when Google Maps can't be used in this page session: the key was rejected, or it failed or timed out. */
export function googleMapsUnavailable(): boolean {
  return keyRejected || loadFailed;
}
