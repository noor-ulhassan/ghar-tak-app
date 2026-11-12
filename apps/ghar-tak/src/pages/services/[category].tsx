import { useListCategories, useListProviders } from '@workspace/api-client-react';
import ServiceCard from '@/components/shared/ServiceCard';
import StoreCard from '@/components/shared/StoreCard';
import { Link } from 'wouter';
import { ArrowLeft, Loader2 } from 'lucide-react';
import SearchInput from '@/components/shared/SearchInput';
import * as Icons from 'lucide-react';
import { useMemo } from 'react';
import { useLocation } from '@/hooks/useLocation';
import { providerDistance, sortByDistance } from '@workspace/geo';

export default function ServiceCategoryPage({ params }: { params: { category: string } }) {
  const { data: categories, isLoading: categoriesLoading } = useListCategories({ query: { queryKey: ["listCategories"] } });
  const categoriesList = Array.isArray(categories) ? categories : [];
  // Older links use the category's name ("Plumber") instead of its id ("plumber").
  const wanted = params.category.toLowerCase();
  const category = categoriesList.find(c => c.id === wanted || c.name.toLowerCase() === wanted);

  // Every kind of provider: product categories like Groceries are made up of stores.
  const { data: providers, isLoading: providersLoading } = useListProviders({ category: params.category }, { query: { enabled: !!params.category, queryKey: ["listProviders", { category: params.category }] } });

  const { location, hasRealLocation } = useLocation();
  const origin = hasRealLocation ? location : null;
  const sortedProviders = useMemo(
    () => sortByDistance(Array.isArray(providers) ? providers : [], origin),
    [providers, origin]
  );

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
        </div>
        <div className="w-full md:w-1/2 lg:w-1/3">
            <SearchInput placeholder={`Search in ${category.name}...`} />
        </div>
      </div>
      
      {sortedProviders.length === 0 ? (
        <p className="text-muted-foreground text-center py-10">No {category.name.toLowerCase()} available in your area currently.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedProviders.map((provider) => (
            provider.type === 'service'
              ? <ServiceCard key={provider.id} serviceProvider={provider} distanceKm={providerDistance(origin, provider)} />
              : <StoreCard key={provider.id} store={provider} distanceKm={providerDistance(origin, provider)} />
          ))}
        </div>
      )}
    </div>
  );
}
