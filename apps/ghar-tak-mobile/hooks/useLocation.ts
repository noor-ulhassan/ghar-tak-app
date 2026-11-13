import { useEffect, useSyncExternalStore } from "react";
import type { Coords } from "@workspace/geo";
import {
  chooseLocation,
  getSnapshot,
  locateAutomatically,
  locateDevice,
  subscribe,
  type ChooseHow,
  type DeviceFix,
  type LocationSource,
  type LocationStatus,
} from "@/lib/location";

export type { ChooseHow, DeviceFix, LocationSource, LocationStatus };

interface UseLocationReturn {
  location: Coords | null;
  source: LocationSource | null;
  accuracyM: number | null;
  place: string | null;
  error: string | null;
  /** True while the saved location is being read, or the first device request is still open. */
  loading: boolean;
  /** "loading" (reading storage), "locating" (first device request open), "ready" or "failed". */
  status: LocationStatus;
  hasRealLocation: boolean;
  chooseLocation: (point: Coords, how: ChooseHow) => void;
  /** Asks the device where it is. It doesn't save: pass the result to chooseLocation. */
  locateDevice: () => Promise<DeviceFix>;
}

export function useLocation(): UseLocationReturn {
  const { saved, status, error } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    void locateAutomatically();
  }, []);

  return {
    location: saved?.point ?? null,
    source: saved?.source ?? null,
    accuracyM: saved?.accuracyM ?? null,
    place: saved?.place ?? null,
    error,
    loading: status === "loading" || status === "locating",
    status,
    hasRealLocation: saved !== null,
    chooseLocation,
    locateDevice,
  };
}
