import { useQuery } from "@tanstack/react-query";

import { useData } from "@/context/DataContext";
import { ApiError } from "@/lib/api";
import { fetchProvider, toServiceProvider, toStore } from "@/lib/db";

/** Retry a failed request once, but not a 404: the shop is gone. */
export function retryUnlessNotFound(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status === 404) return false;
  return failureCount < 1;
}

/**
 * One provider for a detail page: from the loaded catalogue when it is there,
 * otherwise from GET /api/providers/:id (a QR code or link opened before the list loaded).
 */
function useProviderRecord(id: string | undefined, inCatalog: boolean) {
  return useQuery({
    queryKey: ["provider", id],
    queryFn: ({ signal }) => fetchProvider(id as string, signal),
    enabled: !!id && !inCatalog,
    retry: retryUnlessNotFound,
  });
}

function notFound(error: unknown) {
  return error instanceof ApiError && error.status === 404;
}

export function useStore(id: string | undefined) {
  const { stores } = useData();
  const fromCatalog = stores.find((s) => s.id === id);
  const query = useProviderRecord(id, !!fromCatalog);
  const store = fromCatalog ?? (query.data ? toStore(query.data) : undefined);
  return {
    store,
    loading: !store && query.isPending && query.fetchStatus !== "idle",
    notFound: !id || (!store && notFound(query.error)),
    error: !store && query.isError && !notFound(query.error) ? query.error : null,
    retry: () => void query.refetch(),
    retrying: query.isFetching,
  };
}

export function useServiceProvider(id: string | undefined) {
  const { serviceProviders } = useData();
  const fromCatalog = serviceProviders.find((p) => p.id === id);
  const query = useProviderRecord(id, !!fromCatalog);
  const provider = fromCatalog ?? (query.data ? toServiceProvider(query.data) : undefined);
  return {
    provider,
    loading: !provider && query.isPending && query.fetchStatus !== "idle",
    notFound: !id || (!provider && notFound(query.error)),
    error: !provider && query.isError && !notFound(query.error) ? query.error : null,
    retry: () => void query.refetch(),
    retrying: query.isFetching,
  };
}
