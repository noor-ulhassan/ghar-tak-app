import { lazy, Suspense, useId } from 'react';
import {
  DEFAULT_DELIVERY_RADIUS_KM,
  MAX_DELIVERY_RADIUS_KM,
  MIN_DELIVERY_RADIUS_KM,
  type Coords,
} from '@workspace/geo';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// The map library is only downloaded when a form with a map opens.
const LocationPicker = lazy(() => import('@/components/shared/LocationPicker'));

export interface ShopLocation {
  point: Coords | null;
  /** As typed, so the field can be empty or half-typed while editing. */
  radiusKm: string;
}

export function initialShopLocation(shop?: {
  lat?: number | null;
  lng?: number | null;
  deliveryRadiusKm?: number | null;
}): ShopLocation {
  return {
    point: shop?.lat != null && shop?.lng != null ? { lat: shop.lat, lng: shop.lng } : null,
    radiusKm: String(shop?.deliveryRadiusKm ?? DEFAULT_DELIVERY_RADIUS_KM),
  };
}

/** What's wrong with the typed radius, or null when it can be saved. */
export function radiusProblem(radiusKm: string): string | null {
  const km = Number(radiusKm);
  if (radiusKm.trim() === '' || !Number.isFinite(km)) return 'Enter a distance in km.';
  if (km < MIN_DELIVERY_RADIUS_KM || km > MAX_DELIVERY_RADIUS_KM) {
    return `Enter a distance from ${MIN_DELIVERY_RADIUS_KM} to ${MAX_DELIVERY_RADIUS_KM} km.`;
  }
  return null;
}

/** The fields to send to the API. Call only when radiusProblem() is null. */
export function shopLocationRequest(location: ShopLocation) {
  return { ...(location.point ?? {}), deliveryRadiusKm: Number(location.radiusKm) };
}

export default function ShopLocationFields({
  providerType,
  value,
  onChange,
  openAt,
}: {
  providerType: string;
  value: ShopLocation;
  onChange: (value: ShopLocation) => void;
  openAt?: Coords | null;
}) {
  const radiusId = useId();
  const isService = providerType === 'service';
  const problem = radiusProblem(value.radiusKm);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{isService ? 'Where you work from' : 'Shop location on the map'}</Label>
        <p className="text-sm text-muted-foreground">
          Move the map until the pin sits on your {isService ? 'base' : 'shop'}. Customers only see you in their
          "near me" lists once this is set.
        </p>
        <Suspense fallback={<div className="h-72 rounded-md border bg-muted animate-pulse" />}>
          <LocationPicker value={value.point} onChange={(point) => onChange({ ...value, point })} openAt={openAt} />
        </Suspense>
      </div>
      <div className="space-y-2">
        <Label htmlFor={radiusId}>{isService ? 'Service area (km)' : 'Delivery radius (km)'}</Label>
        <Input
          id={radiusId}
          type="number"
          inputMode="decimal"
          min={MIN_DELIVERY_RADIUS_KM}
          max={MAX_DELIVERY_RADIUS_KM}
          step={0.5}
          value={value.radiusKm}
          onChange={(e) => onChange({ ...value, radiusKm: e.target.value })}
          aria-invalid={problem !== null}
          className="max-w-[10rem]"
        />
        <p className={`text-xs ${problem ? 'text-destructive' : 'text-muted-foreground'}`}>
          {problem ??
            `How far you ${isService ? 'travel to customers' : 'deliver'}, in a straight line from the pin. ${MIN_DELIVERY_RADIUS_KM} to ${MAX_DELIVERY_RADIUS_KM} km.`}
        </p>
      </div>
    </div>
  );
}
