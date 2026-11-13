import LazyMapChunk from '@/components/shared/LazyMapChunk';
import type { LocationPickerProps } from '@/components/shared/LocationPicker';

// The map library is only downloaded when a form with a map opens.
const loadLocationPicker = () => import('@/components/shared/LocationPicker');

/**
 * LocationPicker, downloaded when first shown. If the download fails the map's spot shows a
 * retry message and the rest of the form keeps working.
 */
export default function LazyLocationPicker(props: LocationPickerProps) {
  return (
    <LazyMapChunk load={loadLocationPicker} componentProps={props} frameClassName="h-72 rounded-md border" />
  );
}
