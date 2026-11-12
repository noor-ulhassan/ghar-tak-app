import type { Provider } from "@workspace/db";

const toNumber = (value: string | null) => (value == null ? null : Number(value));

/** A provider as every route returns it. `distanceKm` is only sent when the request gave a location. */
export function providerJson(p: Provider, extra: { distanceKm?: number } = {}) {
  return {
    id: p.id,
    userId: p.userId,
    name: p.name,
    type: p.type,
    description: p.description ?? null,
    address: p.address ?? null,
    phone: p.phone ?? null,
    email: p.email ?? null,
    avatarUrl: p.avatarUrl ?? null,
    coverUrl: p.coverUrl ?? null,
    isOpen: p.isOpen ?? true,
    openingHours: p.openingHours ?? null,
    deliveryRadiusKm: toNumber(p.deliveryRadiusKm),
    lat: toNumber(p.lat),
    lng: toNumber(p.lng),
    rating: Number(p.rating ?? 0),
    reviewCount: p.reviewCount ?? 0,
    isFavorite: false,
    planId: p.planId ?? null,
    category: p.category ?? null,
    isVerified: p.isVerified ?? false,
    createdAt: p.createdAt.toISOString(),
    ...(extra.distanceKm === undefined ? {} : { distanceKm: extra.distanceKm }),
  };
}
