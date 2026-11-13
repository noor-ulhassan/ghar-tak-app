import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { ApiError } from "@/lib/api";
import { fetchProviders, fetchServiceCategories } from "@/lib/db";
import type { ServiceCategory, ServiceProvider, Store } from "@/lib/data";

interface Catalog {
  stores: Store[];
  serviceCategories: ServiceCategory[];
  serviceProviders: ServiceProvider[];
}

interface DataContextType extends Catalog {
  /** True until the first list arrives from the saved copy or the server. */
  loading: boolean;
  /** A list is showing (saved or live), even if it is empty. */
  ready: boolean;
  refreshing: boolean;
  /** Why the last load failed, or null when it worked. */
  error: string | null;
  /** The server could not be reached, so the screens show the last saved list. */
  showingSaved: boolean;
  refresh: () => Promise<void>;
}

const EMPTY_CATALOG: Catalog = {
  stores: [],
  serviceCategories: [],
  serviceProviders: [],
};

// v2 holds API data. v1 held the old New York sample catalogue and is never read again.
const CACHE_KEY = "ghar_tak_catalog_cache_v2";
const OLD_CACHE_KEYS = ["ghar_tak_catalog_cache_v1"];

const DataContext = createContext<DataContextType>({
  ...EMPTY_CATALOG,
  loading: true,
  ready: false,
  refreshing: false,
  error: null,
  showingSaved: false,
  refresh: async () => {},
});

/** Every entry has an id and a name; stores and providers also a location, which the screens read unchecked. */
function isEntry(item: unknown, withLocation: boolean): boolean {
  if (!item || typeof item !== "object") return false;
  const { id, name, location } = item as { id?: unknown; name?: unknown; location?: unknown };
  return (
    typeof id === "string" &&
    typeof name === "string" &&
    (!withLocation || (typeof location === "object" && location !== null))
  );
}

/** A saved copy the screens can use. One broken entry could crash them, so then none of it is used. */
function isCatalog(value: unknown): value is Catalog {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Catalog>;
  return (
    Array.isArray(candidate.stores) &&
    Array.isArray(candidate.serviceCategories) &&
    Array.isArray(candidate.serviceProviders) &&
    candidate.stores.every((store) => isEntry(store, true)) &&
    candidate.serviceCategories.every((category) => isEntry(category, false)) &&
    candidate.serviceProviders.every((provider) => isEntry(provider, true))
  );
}

type Source = "none" | "saved" | "live";

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog>(EMPTY_CATALOG);
  const [source, setSource] = useState<Source>("none");
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef<Promise<void> | null>(null);
  const gotLive = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return inFlight.current;

    const run = (async () => {
      try {
        const [{ stores, serviceProviders }, serviceCategories] = await Promise.all([
          fetchProviders(),
          fetchServiceCategories(),
        ]);
        const next: Catalog = { stores, serviceCategories, serviceProviders };
        gotLive.current = true;
        setCatalog(next);
        setSource("live");
        setError(null);
        try {
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next));
        } catch {
          // Cache writes are best-effort.
        }
      } catch (err) {
        // Keep whatever is showing (the saved list, or the last live one).
        setError(
          err instanceof ApiError ? err.message : "Couldn't load shops. Please try again.",
        );
      } finally {
        setAttempted(true);
      }
    })();

    inFlight.current = run;
    try {
      await run;
    } finally {
      inFlight.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      AsyncStorage.multiRemove(OLD_CACHE_KEYS).catch(() => {});
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (raw && !cancelled) {
          const cached: unknown = JSON.parse(raw);
          // A pull-to-refresh may already have answered; never replace live data with the saved copy.
          if (isCatalog(cached) && !gotLive.current) {
            setCatalog(cached);
            setSource("saved");
          }
        }
      } catch {
        // No saved list: wait for the server.
      }
      if (cancelled) return;
      await load();
    })();

    return () => {
      cancelled = true;
    };
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const ready = source !== "none";
  const value = useMemo<DataContextType>(
    () => ({
      ...catalog,
      loading: !ready && !attempted,
      ready,
      refreshing,
      error,
      showingSaved: ready && error !== null,
      refresh,
    }),
    [catalog, ready, attempted, refreshing, error, refresh],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}
