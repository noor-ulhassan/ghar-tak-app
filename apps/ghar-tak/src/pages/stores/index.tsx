import { useListProviders, getListProvidersQueryKey } from '@workspace/api-client-react';
import StoreCard from '@/components/shared/StoreCard';
import SearchInput from '@/components/shared/SearchInput';
import { NearbyScopeSwitch, NoneNearby } from '@/components/shared/NearbyScope';
import LoadError from '@/components/shared/LoadError';
import { ShoppingCart, Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { useNearbyScope } from '@/hooks/useNearby';
import { providerDistance, sortByDistance } from '@workspace/geo';

export default function AllStoresPage() {
  const { point, filterPoint, showAll, approximate } = useNearbyScope();
  // With a location the server sends only the stores that deliver there, nearest first.
  const params = filterPoint ?? {};
  const { data: providers, isLoading, isError, isFetching, refetch } = useListProviders(params, { query: { queryKey: getListProvidersQueryKey(params) } });
  // Restaurants sell through the same store page, so they are listed with the stores.
  const stores = useMemo(
    () => (Array.isArray(providers) ? providers : []).filter((p) => p.type !== 'service'),
    [providers]
  );

  const sortedStores = useMemo(
    () => (filterPoint ? stores : sortByDistance(stores, point)),
    [stores, filterPoint, point]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <div className="flex items-center">
            <ShoppingCart className="h-8 w-8 text-primary mr-3" />
            <h1 className="text-3xl font-bold font-headline">{filterPoint ? 'Stores near you' : 'All Stores'}</h1>
          </div>
          {point && <NearbyScopeSwitch path="/stores" showAll={showAll} approximate={approximate} />}
        </div>
        <div className="w-full md:w-1/2 lg:w-1/3">
         <SearchInput placeholder="Search stores..." />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-primary h-8 w-8" />
        </div>
      ) : isError && !providers ? (
        <LoadError what="stores" retrying={isFetching} onRetry={() => void refetch()} />
      ) : sortedStores.length === 0 ? (
        filterPoint ? (
          <NoneNearby message="No stores deliver to your location yet." allHref="/stores?view=all" allLabel="Browse all stores" />
        ) : (
          <p className="text-muted-foreground text-center py-10">No stores available at the moment.</p>
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedStores.map((store) => (
            <StoreCard
              key={store.id}
              store={store}
              distanceKm={store.distanceKm ?? providerDistance(point, store)}
              approximate={approximate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
