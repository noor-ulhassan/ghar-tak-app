import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ExpoLocation from "expo-location";
import { CITY_ACCURACY_M, type Coords } from "@workspace/geo";

// Where the customer is, for the "near me" lists. One store for every screen, so they all show
// the same location at the same moment. It mirrors the website's apps/ghar-tak/src/hooks/useLocation.ts.
// Nothing here draws UI: screens use hooks/useLocation.ts.

const STORAGE_KEY = "ghar_tak_user_location_v1";
// Set once the app has shown the permission prompt by itself (see automaticPermission).
const ASKED_KEY = "ghar_tak_location_asked_v1";

/** Where the location came from: the device (GPS or Wi-Fi), or a spot the customer pinned on the map. */
export type LocationSource = "device" | "chosen";

export interface SavedLocation {
  point: Coords;
  source: LocationSource;
  /** How far off the location may be, in metres: as the device reports it, or set for a picked city. */
  accuracyM: number | null;
  /** The city the customer picked, when they picked a city rather than a spot. */
  place: string | null;
  savedAt: number;
}

/**
 * loading: the saved location is still being read from storage.
 * locating: nothing is saved and the first device request is open.
 * ready: a location is known. failed: none is known.
 */
export type LocationStatus = "loading" | "locating" | "ready" | "failed";

export interface LocationState {
  saved: SavedLocation | null;
  status: LocationStatus;
  error: string | null;
}

/**
 * How the customer got the location they save. A device reading they kept as it was stays a
 * device location: it refreshes daily and is flagged when vague. Anything else is a chosen
 * spot, or a city when `place` is given.
 */
export type ChooseHow =
  // Some devices give no accuracy (DeviceFix.accuracyM is null); then it is unknown, not vague.
  | { source: "device"; accuracyM: number | null }
  | { source: "chosen"; accuracyM?: number | null; place?: string };

export type DeviceFailure = "denied" | "unavailable" | "timeout";

export type DeviceFix =
  | { ok: true; point: Coords; accuracyM: number | null }
  // canAskAgain false: the phone won't show the prompt again, so only its settings can allow it.
  | { ok: false; reason: "denied"; canAskAgain: boolean }
  | { ok: false; reason: Exclude<DeviceFailure, "denied"> };

// After a day a device location may be out of date (the customer moved), so it is refreshed.
// A spot the customer pinned stays until they change it.
const MAX_DEVICE_LOCATION_AGE_MS = 24 * 60 * 60 * 1000;
// The phone's own request doesn't count the time its permission prompt stays open, so a
// customer who ignores the prompt would wait forever. After this the location counts as
// unknown; an answer that comes later is still used.
const PROMPT_WAIT_MS = 10000;
// Once permission is given, a device that can't find itself (indoors, no signal) may keep
// trying for minutes. After this it counts as a timeout.
const POSITION_WAIT_MS = 15000;
// The web version reads the position with maximumAge Infinity unless told otherwise, so it
// could hand back a fix hours old. Five minutes is fresh enough; the phones ignore this option.
const FRESH_POSITION_MS = 5 * 60 * 1000;
const NO_LOCATION = "Could not get your location.";

const inRange = (value: unknown, limit: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit;

/** Reads and checks the saved location. Anything unusable counts as nothing saved. */
async function readSaved(): Promise<SavedLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    const lat = parsed?.lat;
    const lng = parsed?.lng;
    const source = parsed?.source;
    // Out of range, the server would refuse every list asked for with it.
    if (!inRange(lat, 90) || !inRange(lng, 180)) return null;
    if (source !== "device" && source !== "chosen") return null;
    const place = typeof parsed?.place === "string" && parsed.place ? parsed.place : null;
    return {
      point: { lat, lng },
      source,
      // A city is never a precise pin, even if its accuracy was lost.
      accuracyM: place
        ? CITY_ACCURACY_M
        : typeof parsed?.accuracyM === "number" && Number.isFinite(parsed.accuracyM)
          ? parsed.accuracyM
          : null,
      place,
      savedAt: typeof parsed?.savedAt === "number" ? parsed.savedAt : 0,
    };
  } catch {
    return null;
  }
}

let state: LocationState = { saved: null, status: "loading", error: null };
const listeners = new Set<() => void>();

function setState(next: Partial<LocationState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  hydrate();
  return () => {
    listeners.delete(listener);
  };
}

export const getSnapshot = () => state;

// Storage is read once, the first time anything listens, not when the file is imported.
let hydration: Promise<void> | null = null;

function hydrate(): Promise<void> {
  hydration ??= readSaved().then((saved) => {
    // A location chosen while storage was still being read wins over the stored one.
    if (state.saved) return;
    setState(saved ? { saved, status: "ready", error: null } : { status: "locating", error: null });
  });
  return hydration;
}

function save(point: Coords, source: LocationSource, accuracyM: number | null, place: string | null) {
  const saved: SavedLocation = {
    point: { lat: point.lat, lng: point.lng },
    source,
    accuracyM,
    place,
    savedAt: Date.now(),
  };
  AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      lat: point.lat,
      lng: point.lng,
      source,
      accuracyM,
      ...(place ? { place } : {}),
      savedAt: saved.savedAt,
    }),
  ).catch(() => {
    // Storage can be unavailable (quota, blocked) - the in-memory copy still works.
  });
  setState({ saved, status: "ready", error: null });
}

export function chooseLocation(point: Coords, how: ChooseHow) {
  save(point, how.source, how.accuracyM ?? null, how.source === "chosen" ? (how.place ?? null) : null);
}

/** Reads the position once permission is given, for at most POSITION_WAIT_MS. */
async function readPosition(): Promise<DeviceFix> {
  if (!(await ExpoLocation.hasServicesEnabledAsync())) return { ok: false, reason: "unavailable" };
  const reading = ExpoLocation.getCurrentPositionAsync({
    accuracy: ExpoLocation.Accuracy.Balanced,
    maximumAge: FRESH_POSITION_MS,
  } as ExpoLocation.LocationOptions).then(({ coords }): DeviceFix => {
    if (!inRange(coords.latitude, 90) || !inRange(coords.longitude, 180)) {
      return { ok: false, reason: "unavailable" };
    }
    return {
      ok: true,
      point: { lat: coords.latitude, lng: coords.longitude },
      // Some devices give no accuracy; then it is unknown, not vague.
      accuracyM: typeof coords.accuracy === "number" && Number.isFinite(coords.accuracy) ? Math.round(coords.accuracy) : null,
    };
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<DeviceFix>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, reason: "timeout" }), POSITION_WAIT_MS);
  });
  try {
    return await Promise.race([reading, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Gets permission with `askPermission`, then asks the device where it is. Never saves anything.
 * The permission answer has no time limit: a customer who takes a while over the prompt still
 * gets their location.
 */
async function readDevice(askPermission: () => Promise<ExpoLocation.LocationPermissionResponse>): Promise<DeviceFix> {
  try {
    const permission = await askPermission();
    if (!permission.granted) {
      // On the web a position read that fails during the prompt comes back as not granted
      // with status "granted": that is no location, not a refusal.
      return permission.status === ExpoLocation.PermissionStatus.DENIED
        ? { ok: false, reason: "denied", canAskAgain: permission.canAskAgain }
        : { ok: false, reason: "unavailable" };
    }
    return await readPosition();
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/**
 * Asks the device where it is, for a "Use my current location" button: it always asks for
 * permission. Finding the position gives up after 15 seconds with reason "timeout". It does not
 * save: the caller decides, with chooseLocation(point, { source: 'device', accuracyM }).
 */
export function locateDevice(): Promise<DeviceFix> {
  return readDevice(ExpoLocation.requestForegroundPermissionsAsync);
}

/**
 * The app shows the permission prompt by itself at most once per install: on Android one
 * "Deny" would otherwise bring it back at every launch. After that it only checks whether
 * permission was given, and the "Use my current location" button is the way to ask again.
 */
async function automaticPermission(): Promise<ExpoLocation.LocationPermissionResponse> {
  const asked = await AsyncStorage.getItem(ASKED_KEY).catch(() => null);
  if (asked) return ExpoLocation.getForegroundPermissionsAsync();
  AsyncStorage.setItem(ASKED_KEY, "1").catch(() => {
    // Storage can be unavailable; then the prompt may show again next launch.
  });
  return ExpoLocation.requestForegroundPermissionsAsync();
}

/** Asks the device on its own. It never replaces a spot the customer pinned. */
async function requestDeviceLocation() {
  const waiting = !state.saved;
  if (waiting) setState({ status: "locating", error: null });
  const giveUp = waiting
    ? setTimeout(() => {
        if (state.status === "locating") setState({ status: "failed", error: NO_LOCATION });
      }, PROMPT_WAIT_MS)
    : undefined;

  const fix = await readDevice(automaticPermission);
  clearTimeout(giveUp);

  if (!fix.ok) {
    // A refresh that fails keeps the old location on screen.
    if (!state.saved) setState({ status: "failed", error: NO_LOCATION });
    return;
  }
  // A spot pinned meanwhile wins over the device.
  if (state.saved?.source === "chosen") {
    setState({ status: "ready", error: null });
    return;
  }
  save(fix.point, "device", fix.accuracyM, null);
}

// The device is asked by itself at most once per app session (and its prompt shows at most
// once per install): a customer who ignored or refused the prompt isn't asked again on every
// screen, and a stale reading is refreshed once. Only their own action (a "Use my current
// location" button) asks again after that.
let askedAutomatically = false;

export async function locateAutomatically() {
  await hydrate();
  if (askedAutomatically) return;
  const { saved } = state;
  const stale = saved?.source === "device" && Date.now() - saved.savedAt > MAX_DEVICE_LOCATION_AGE_MS;
  if (saved && !stale) return;
  askedAutomatically = true;
  await requestDeviceLocation();
}
