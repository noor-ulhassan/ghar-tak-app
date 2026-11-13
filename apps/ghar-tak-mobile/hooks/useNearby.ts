import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { isApproximate, type Coords } from "@workspace/geo";

import { useData } from "@/context/DataContext";
import { useLocation } from "@/hooks/useLocation";
import { nearestFirst } from "@/lib/data";
import { fetchProviderList } from "@/lib/db";

// About 11 m: a GPS reading that moves a little keeps the same lists.
const round = (value: number) => Math.round(value * 1e4) / 1e4;

type ProviderList = Awaited<ReturnType<typeof fetchProviderList>>;

/**
 * The near-me and category queries' placeholder: a new pin keeps the last list on screen until
 * the new one arrives, rather than a spinner. An empty one isn't kept: it would flash "none here".
 */
export function keepPreviousList(previous: ProviderList | undefined) {
  return previous && (previous.stores.length > 0 || previous.serviceProviders.length > 0) ? previous : undefined;
}

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

/**
 * A list screen's "Show all" switch, kept in its `view` param like the website's ?view=all,
 * so another screen can open it already showing everything.
 */
export function useShowAll() {
  const { view } = useLocalSearchParams<{ view?: string }>();
  const showAll = view === "all";
  return { showAll, setShowAll: (on: boolean) => router.setParams({ view: on ? "all" : undefined }) };
}

/**
 * The stores and service providers for a "near me" list. With a precise location (and Show all
 * off) they come from the server, only those that reach the customer, nearest first. Otherwise
 * it is the whole catalogue, nearest first when any location is known.
 */
export function useNearbyCatalog(showAll: boolean) {
  const { point, filterPoint: nearPoint, approximate } = useNearbyFilter();
  const locating = useLocation().loading;
  const filterPoint = showAll ? null : nearPoint;
  const catalog = useData();
  const near = useQuery({
    queryKey: ["providers", "near", filterPoint?.lat, filterPoint?.lng],
    queryFn: ({ signal }) => fetchProviderList({ near: filterPoint }, signal),
    enabled: filterPoint !== null,
    placeholderData: (previous) => keepPreviousList(previous),
    // Offline, TanStack would pause the request and spin forever; apiGet already reports an
    // unreachable server as an error, with Retry.
    networkMode: "always",
  });

  // Until the location is known, nothing is listed: every shop, then only the near ones, would flash.
  const stores = useMemo(
    () => (locating ? [] : filterPoint ? (near.data?.stores ?? []) : nearestFirst(catalog.stores, point)),
    [locating, filterPoint, near.data, catalog.stores, point],
  );
  const serviceProviders = useMemo(
    () =>
      locating
        ? []
        : filterPoint
          ? (near.data?.serviceProviders ?? [])
          : nearestFirst(catalog.serviceProviders, point),
    [locating, filterPoint, near.data, catalog.serviceProviders, point],
  );

  const filtering = filterPoint !== null;
  return {
    point,
    filterPoint,
    approximate,
    stores,
    serviceProviders,
    /**
     * The near-me request, also loading while the location is still being found. When not
     * filtering (and not locating), CatalogNotice covers the catalogue instead.
     */
    near: {
      loading: locating || (filtering && near.isPending),
      // A failed refresh keeps the list it already has.
      error: filtering && near.isError && !near.data ? near.error : null,
      retry: () => void near.refetch(),
      retrying: near.isFetching,
    },
    // A new pin's request shows the last list, not the pull-to-refresh spinner.
    refreshing: catalog.refreshing || (filtering && near.isRefetching && !near.isPlaceholderData),
    refresh: async () => {
      await Promise.all([catalog.refresh(), filtering ? near.refetch() : null]);
    },
  };
}
