import { useState, useMemo } from 'react';
import { useListProviders, useListProviderProducts, getListProvidersQueryKey } from '@workspace/api-client-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProductCard from '@/components/shared/ProductCard';
import { ShoppingBag, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useCustomerPoint } from '@/hooks/useNearby';

function StoreProducts({ storeId, storeName }: { storeId: string; storeName: string }) {
  const { data: products, isLoading } = useListProviderProducts(storeId, undefined, { query: { enabled: !!storeId, queryKey: ["listProviderProducts", storeId] } });

  if (isLoading) return <div className="py-10 text-center"><Loader2 className="animate-spin text-primary inline" /></div>;

  if (!Array.isArray(products) || products.length === 0) {
    return (
      <div className="text-center py-10 px-6 border rounded-lg bg-card shadow-sm">
        <p className="text-lg text-muted-foreground">No products found for {storeName}.</p>
        <p className="text-md text-muted-foreground mt-2">Check out the <Link href={`/stores/${storeId}`} className="text-primary hover:underline">store page</Link> for more details.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="w-full whitespace-nowrap rounded-md">
      <div className="flex w-max space-x-4 p-4">
        {products.map((product) => (
          <div key={product.id} className="w-64 whitespace-normal">
            <ProductCard product={product} providerId={storeId} providerName={storeName} />
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

export default function ShopByStoreSection() {
  // With a location the server sends only the stores that deliver there, nearest first.
  // Restaurants are listed with the stores (they sell through the same store page).
  const point = useCustomerPoint();
  const params = point ?? {};
  const { data: providers, isLoading: storesLoading } = useListProviders(params, { query: { queryKey: getListProvidersQueryKey(params) } });

  const [selectedStoreId, setSelectedStoreId] = useState('');

  const displayedStores = useMemo(
    () => (Array.isArray(providers) ? providers : []).filter((p) => p.type !== 'service').slice(0, 3),
    [providers]
  );

  // When the location arrives the list changes, and the chosen store may drop out of
  // the top three; fall back to the nearest one instead of showing an empty tab.
  const activeStoreId = displayedStores.some((store) => store.id === selectedStoreId)
    ? selectedStoreId
    : (displayedStores[0]?.id ?? '');

  if (storesLoading) {
    return (
      <section className="py-8 md:py-12">
        <div className="flex items-center mb-8">
          <ShoppingBag className="h-8 w-8 text-primary mr-3" />
          <h2 className="text-3xl font-headline font-bold">Shop from Nearby Stores</h2>
        </div>
        <div className="flex justify-center items-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  if (displayedStores.length === 0) return null;

  return (
    <section className="py-8 md:py-12">
      <div className="flex items-center mb-8">
        <ShoppingBag className="h-8 w-8 text-primary mr-3" />
        <h2 className="text-3xl font-headline font-bold">Shop from Nearby Stores</h2>
      </div>

      <Tabs value={activeStoreId} onValueChange={setSelectedStoreId} className="w-full">
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-3 mb-6 h-auto">
          {displayedStores.map((store) => (
            <TabsTrigger key={store.id} value={store.id} className="py-3 text-md whitespace-normal">
              {store.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {displayedStores.map((store) => (
          <TabsContent key={store.id} value={store.id}>
            <StoreProducts storeId={store.id} storeName={store.name} />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
