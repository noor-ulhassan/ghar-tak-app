import { useListCategories, useListProviders, getListProvidersQueryKey } from '@workspace/api-client-react';
import ServiceCard from '@/components/shared/ServiceCard';
import { NearbyScopeSwitch, NoneNearby } from '@/components/shared/NearbyScope';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'wouter';
import SearchInput from '@/components/shared/SearchInput';
import { Users, Loader2 } from 'lucide-react'; 
import * as Icons from 'lucide-react';
import { useMemo } from 'react';
import { useNearbyScope } from '@/hooks/useNearby';
import { providerDistance, sortByDistance } from '@workspace/geo';

export default function AllServicesPage() {
  const { data: categories, isLoading: categoriesLoading } = useListCategories({ query: { queryKey: ["listCategories"] } });
  const { point, filterPoint, showAll } = useNearbyScope();
  // With a location the server sends only the providers whose service area covers it, nearest first.
  const params = { type: 'service' as const, ...filterPoint };
  const { data: providers, isLoading: providersLoading } = useListProviders(params, { query: { queryKey: getListProvidersQueryKey(params) } });

  const sortedProviders = useMemo(() => {
    const list = Array.isArray(providers) ? providers : [];
    return filterPoint ? list : sortByDistance(list, point);
  }, [providers, filterPoint, point]);

  return (
    <div className="space-y-12">
      <section>
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
            <div className="flex items-center">
                <Users className="h-8 w-8 text-primary mr-3" />
                <h1 className="text-3xl font-bold font-headline">Service Categories</h1>
            </div>
            <div className="w-full md:w-1/2 lg:w-1/3">
                <SearchInput placeholder="Search services..." />
            </div>
        </div>
        {categoriesLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary h-8 w-8" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {(Array.isArray(categories) ? categories : []).map((category) => {
              // @ts-ignore
              const Icon = category.icon && Icons[category.icon] ? Icons[category.icon] : Icons.Grid;
              return (
                <Link key={category.id} href={`/services/${category.id}`} className="group">
                  <Card className="text-center h-full flex flex-col items-center justify-between p-4 transition-all hover:shadow-xl hover:border-primary transform hover:-translate-y-1">
                    <CardHeader className="p-0 mb-3">
                      <Icon className="h-12 w-12 text-primary group-hover:text-accent transition-colors" />
                    </CardHeader>
                    <CardContent className="p-0">
                      <CardTitle className="text-lg font-semibold group-hover:text-primary transition-colors">{category.name}</CardTitle>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-semibold font-headline">{filterPoint ? 'Service Providers Near You' : 'Featured Service Providers'}</h2>
          {point && <NearbyScopeSwitch path="/services" showAll={showAll} />}
        </div>
        {providersLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary h-8 w-8" /></div>
        ) : sortedProviders.length === 0 ? (
          filterPoint ? (
            <NoneNearby message="No service providers cover your location yet." allHref="/services?view=all" allLabel="See all service providers" />
          ) : (
            <p className="text-muted-foreground text-center py-10">No service providers available at the moment.</p>
          )
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedProviders.slice(0,6).map((provider) => (
              <ServiceCard key={provider.id} serviceProvider={provider} distanceKm={provider.distanceKm ?? providerDistance(point, provider)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
