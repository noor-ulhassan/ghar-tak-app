import { useListCategories, useListProviders, getListProvidersQueryKey } from '@workspace/api-client-react';
import ServiceCard from '@/components/shared/ServiceCard';
import StoreCard from '@/components/shared/StoreCard';
import { NearbyScopeSwitch, NoneNearby } from '@/components/shared/NearbyScope';
import { Link } from 'wouter';
import { ArrowLeft, Loader2 } from 'lucide-react';
import SearchInput from '@/components/shared/SearchInput';
import * as Icons from 'lucide-react';
import { useMemo } from 'react';
import { useNearbyScope } from '@/hooks/useNearby';
import { providerDistance, sortByDistance } from '@workspace/geo';

export default function ServiceCategoryPage({ params }: { params: { category: string } }) {
  const { data: categories, isLoading: categoriesLoading } = useListCategories({ query: { queryKey: ["listCategories"] } });
  const categoriesList = Array.isArray(categories) ? categories : [];
  // Older links use the category's name ("Plumber") instead of its id ("plumber").
  const wanted = params.category.toLowerCase();
  const category = categoriesList.find(c => c.id === wanted || c.name.toLowerCase() === wanted);

  // Every kind of provider: product categories like Groceries are made up of stores.
  // With a location the server sends only those that reach it, nearest first.
  const { point, filterPoint, showAll, approximate } = useNearbyScope();
  const listParams = { category: params.category, ...filterPoint };
  const { data: providers, isLoading: providersLoading } = useListProviders(listParams, { query: { enabled: !!params.category, queryKey: getListProvidersQueryKey(listParams) } });

  const sortedProviders = useMemo(() => {
    const list = Array.isArray(providers) ? providers : [];
    return filterPoint ? list : sortByDistance(list, point);
  }, [providers, filterPoint, point]);

  if (categoriesLoading || providersLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary h-8 w-8" /></div>;
  }

  if (!category) {
    return (
      <div className="text-center py-10">
        <h1 className="text-2xl font-bold">Service category not found</h1>
        <Link href="/services" className="text-primary hover:underline mt-4 inline-block">
          Back to all services
        </Link>
      </div>
    );
  }

  // @ts-ignore
  const Icon = category.icon && Icons[category.icon] ? Icons[category.icon] : Icons.Grid;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <Link href="/services" className="flex items-center text-sm text-primary hover:underline mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" />
            All Service Categories
          </Link>
          <div className="flex items-center">
            <Icon className="h-8 w-8 text-primary mr-3" />
            <h1 className="text-3xl font-bold font-headline">{category.name}</h1>
          </div>
          {point && <NearbyScopeSwitch path={`/services/${params.category}`} showAll={showAll} approximate={approximate} />}
        </div>
        <div className="w-full md:w-1/2 lg:w-1/3">
            <SearchInput placeholder={`Search in ${category.name}...`} />
        </div>
      </div>

      {sortedProviders.length === 0 ? (
        filterPoint ? (
          <NoneNearby
            message={`No ${category.name.toLowerCase()} reach your location yet.`}
            allHref={`/services/${params.category}?view=all`}
            allLabel={`See all ${category.name.toLowerCase()}`}
          />
        ) : (
          <p className="text-muted-foreground text-center py-10">No {category.name.toLowerCase()} available currently.</p>
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedProviders.map((provider) => {
            const distanceKm = provider.distanceKm ?? providerDistance(point, provider);
            return provider.type === 'service'
              ? <ServiceCard key={provider.id} serviceProvider={provider} distanceKm={distanceKm} />
              : <StoreCard key={provider.id} store={provider} distanceKm={distanceKm} />;
          })}
        </div>
      )}
    </div>
  );
}
