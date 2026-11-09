import { useSearch as useSearchString, Link } from 'wouter';
import {
  useSearch as useSearchQuery,
  getSearchQueryKey,
  useListProviders,
  getListProvidersQueryKey,
} from '@workspace/api-client-react';
import ProductCard from '@/components/shared/ProductCard';
import StoreCard from '@/components/shared/StoreCard';
import ServiceCard from '@/components/shared/ServiceCard';
import SearchInput from '@/components/shared/SearchInput';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchX, Loader2, Wrench } from 'lucide-react';

export default function SearchPage() {
  const rawSearch = useSearchString();
  const query = new URLSearchParams(rawSearch).get('q') || '';

  const { data: results, isLoading } = useSearchQuery(
    { q: query },
    { query: { queryKey: getSearchQueryKey({ q: query }), enabled: !!query } },
  );

  const providers = results?.providers ?? [];
  const products = results?.products ?? [];
  const services = results?.services ?? [];

  // Product and service results only carry a provider ID; look up the provider's name and type.
  const { data: allProviders } = useListProviders(
    {},
    { query: { queryKey: getListProvidersQueryKey({}), enabled: !!query } },
  );
  const providerById = new Map((Array.isArray(allProviders) ? allProviders : []).map((p) => [p.id, p]));

  const stores = providers.filter((p) => p.type !== 'service');
  const serviceProviders = providers.filter((p) => p.type === 'service');

  const hasResults = providers.length > 0 || products.length > 0 || services.length > 0;

  return (
    <div className="space-y-8">
      <SearchInput initialQuery={query} placeholder="Search again..." />
      <h1 className="text-3xl font-bold font-headline">
        Search Results {query ? `for "${query}"` : ''}
      </h1>

      {isLoading && query && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && !hasResults && query && (
        <div className="text-center py-12">
          <SearchX className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">No Results Found</h2>
          <p className="text-muted-foreground">Try a different search term or explore our categories.</p>
        </div>
      )}

      {stores.length > 0 && (
        <section>
          <h2 className="text-2xl font-semibold font-headline mb-4">Stores</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map((store) => <StoreCard key={store.id} store={store} />)}
          </div>
        </section>
      )}

      {serviceProviders.length > 0 && (
        <section>
          <h2 className="text-2xl font-semibold font-headline mb-4">Service Providers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {serviceProviders.map((sp) => <ServiceCard key={sp.id} serviceProvider={sp} />)}
          </div>
        </section>
      )}

      {services.length > 0 && (
        <section>
          <h2 className="text-2xl font-semibold font-headline mb-4">Services</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <Link
                key={service.id}
                href={
                  providerById.get(service.providerId)?.type === 'service'
                    ? `/services/${service.category || 'all'}/${service.providerId}`
                    : `/stores/${service.providerId}`
                }
              >
                <Card className="hover:shadow-lg transition-all cursor-pointer h-full">
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                      <Wrench className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{service.name}</h3>
                      <p className="text-sm text-muted-foreground">{service.category}</p>
                      {service.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{service.description}</p>
                      )}
                      <Badge variant="outline" className="mt-2">{service.priceRange}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {products.length > 0 && (
        <section>
          <h2 className="text-2xl font-semibold font-headline mb-4">Products</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                providerId={product.providerId}
                providerName={providerById.get(product.providerId)?.name}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
