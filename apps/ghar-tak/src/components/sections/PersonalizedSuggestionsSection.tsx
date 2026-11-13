import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@clerk/react';
import { useListMyOrders, useListProviders, useListProviderProducts, getListProvidersQueryKey } from '@workspace/api-client-react';
import { getPersonalizedProductRecommendations, PersonalizedProductRecommendationsInput } from '@/ai/flows/product-recommendations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ArrowRight, Loader2, Search } from 'lucide-react';
import { Link } from 'wouter';
import { useLocation } from '@/hooks/useLocation';
import { useNearbyFilter } from '@/hooks/useNearby';
import { sortByDistance } from '@workspace/geo';

const NEAREST_STORES = 3;
const MAX_PRODUCTS_PER_STORE = 8;
// The suggestions service passes the location on to OpenAI: 2 decimals (about 1 km) is
// enough to suggest local products and says less about where the customer lives.
const roundForAi = (value: number) => Math.round(value * 100) / 100;

export default function PersonalizedSuggestionsSection() {
  const { user, isLoaded } = useUser();
  // Wait until the location is known or given up on (at most about 10 s), so the paid
  // suggestions are asked for once, not once before the location and again after it.
  const { loading: locating } = useLocation();
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // With a precise location the server sends only the stores that deliver there, nearest
  // first; with a rough one every store is listed, nearest first by that rough location.
  const { point, filterPoint } = useNearbyFilter();
  const storeParams = { type: 'store' as const, ...filterPoint };
  const { data: stores, isLoading: storesLoading } = useListProviders(
    storeParams,
    { query: { queryKey: getListProvidersQueryKey(storeParams) } }
  );
  const { data: orders, isLoading: ordersLoading } = useListMyOrders({
    query: { enabled: !!user, queryKey: ["listMyOrders"] },
  });

  const nearestStores = useMemo(() => {
    const list = Array.isArray(stores) ? stores : [];
    return (filterPoint ? list : sortByDistance(list, point)).slice(0, NEAREST_STORES);
  }, [stores, filterPoint, point]);

  const store1 = nearestStores[0]?.id ?? '';
  const store2 = nearestStores[1]?.id ?? '';
  const store3 = nearestStores[2]?.id ?? '';

  const { data: products1, isLoading: products1Loading } = useListProviderProducts(store1, undefined, {
    query: { enabled: !!store1, queryKey: ["listProviderProducts", store1] },
  });
  const { data: products2, isLoading: products2Loading } = useListProviderProducts(store2, undefined, {
    query: { enabled: !!store2, queryKey: ["listProviderProducts", store2] },
  });
  const { data: products3, isLoading: products3Loading } = useListProviderProducts(store3, undefined, {
    query: { enabled: !!store3, queryKey: ["listProviderProducts", store3] },
  });

  const isLoadingContext =
    locating || storesLoading || ordersLoading || products1Loading || products2Loading || products3Loading;

  const aiLat = point ? roundForAi(point.lat) : null;
  const aiLng = point ? roundForAi(point.lng) : null;

  const recommendationInput = useMemo<PersonalizedProductRecommendationsInput>(() => {
    const productLists = [products1, products2, products3];
    const nearbyStores = nearestStores
      .map((store, index) => ({
        storeName: store.name,
        products: (productLists[index] ?? []).map((product) => product.name).slice(0, MAX_PRODUCTS_PER_STORE),
      }))
      .filter((store) => store.products.length > 0);

    const pastPurchases = Array.from(
      new Set(
        (Array.isArray(orders) ? orders : [])
          .filter((order) => order.status !== 'cancelled')
          .flatMap((order) => order.items.map((item) => item.name))
      )
    ).slice(0, 10);

    const input: PersonalizedProductRecommendationsInput = {};
    if (aiLat !== null && aiLng !== null) input.userLocation = { latitude: aiLat, longitude: aiLng };
    if (pastPurchases.length) input.pastPurchases = pastPurchases;
    if (nearbyStores.length) input.nearbyStores = nearbyStores;
    return input;
  }, [nearestStores, products1, products2, products3, orders, aiLat, aiLng]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      setIsLoading(false);
      return;
    }
    if (isLoadingContext) {
      setIsLoading(true);
      return;
    }
    if (!recommendationInput.nearbyStores && !recommendationInput.pastPurchases && !recommendationInput.userLocation) {
      setRecommendations([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchRecommendations() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getPersonalizedProductRecommendations(recommendationInput);
        if (!cancelled) setRecommendations(result.recommendedProducts || []);
      } catch {
        if (!cancelled) {
          setError("Could not load suggestions at this time.");
          setRecommendations([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchRecommendations();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, user?.id, isLoadingContext, recommendationInput]);

  if (isLoading) {
    return (
      <div className="py-8">
        <h2 className="text-2xl font-headline font-bold mb-6 text-center md:text-left">Just For You</h2>
        <div className="flex items-center justify-center p-8 border rounded-lg bg-card min-h-[150px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Loading personalized suggestions...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <section className="py-8 md:py-12">
        <h2 className="text-3xl font-headline font-bold mb-8 text-center md:text-left">Just For You</h2>
        <div className="text-center py-10 px-6 border rounded-lg bg-card shadow-sm min-h-[150px] flex flex-col items-center justify-center">
          <Search className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg text-muted-foreground mb-3">Sign in to get personalized suggestions based on your area and past orders.</p>
          <Button asChild variant="outline">
            <Link href="/sign-in">Sign In</Link>
          </Button>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <div className="py-8">
        <h2 className="text-2xl font-headline font-bold mb-6 text-center md:text-left">Just For You</h2>
        <div className="p-8 border rounded-lg bg-destructive/10 text-destructive text-center min-h-[150px] flex flex-col items-center justify-center">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <section className="py-8 md:py-12">
        <h2 className="text-3xl font-headline font-bold mb-8 text-center md:text-left">Just For You</h2>
        <div className="text-center py-10 px-6 border rounded-lg bg-card shadow-sm min-h-[150px] flex flex-col items-center justify-center">
          <Search className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg text-muted-foreground mb-1">No suggestions right now.</p>
          <p className="text-md text-muted-foreground">Search something to suggest or enable location!</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8 md:py-12">
      <h2 className="text-3xl font-headline font-bold mb-8 text-center md:text-left">Just For You</h2>
      <ScrollArea className="w-full whitespace-nowrap rounded-md">
        <div className="flex w-max space-x-4 p-4">
          {recommendations.map((productName, index) => (
            <Card key={index} className="w-64 min-w-[250px] flex-shrink-0 shadow-lg overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg font-semibold line-clamp-2 h-14">{productName}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">You might like this product based on your activity and local availability.</p>
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/search?q=${encodeURIComponent(productName)}`}>
                    Find Product <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </section>
  );
}
