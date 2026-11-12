import { useListProviders, getListProvidersQueryKey } from '@workspace/api-client-react';
import StoreCard from '@/components/shared/StoreCard';
import SearchInput from '@/components/shared/SearchInput';
import { ShoppingCart, Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { useLocation } from '@/hooks/useLocation';
import { providerDistance, sortByDistance } from '@workspace/geo';

export default function AllStoresPage() {
  // Restaurants sell through the same store page, so they are listed with the stores.
  const { data: providers, isLoading } = useListProviders({}, { query: { queryKey: getListProvidersQueryKey({}) } });
  const stores = useMemo(
    () => (Array.isArray(providers) ? providers : []).filter((p) => p.type !== 'service'),
    [providers]
  );
  const { location, hasRealLocation } = useLocation();
  const origin = hasRealLocation ? location : null;

  const sortedStores = useMemo(
    () => sortByDistance(stores, origin),
    [stores, origin]
  );
  
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center">
          <ShoppingCart className="h-8 w-8 text-primary mr-3" />
          <h1 className="text-3xl font-bold font-headline">All Stores</h1>
        </div>
        <div className="w-full md:w-1/2 lg:w-1/3">
         <SearchInput placeholder="Search stores..." />
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-primary h-8 w-8" />
        </div>
      ) : sortedStores.length === 0 ? (
        <p className="text-muted-foreground text-center py-10">No stores available at the moment.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedStores.map((store) => (
            <StoreCard key={store.id} store={store} distanceKm={providerDistance(origin, store)} />
          ))}
        </div>
      )}
    </div>
  );
}
