import type { Coords } from "@workspace/geo";

import { apiGet } from "./api";
import {
  categoryIcon,
  type Product,
  type ProviderLocation,
  type ProviderType,
  type Service,
  type ServiceCategory,
  type ServiceProvider,
  type Store,
} from "./data";

// The catalogue comes from the public Ghar Tak API, the same shops the website shows.
// See apps/api-server/src/routes (providers, products, services, categories).

export interface ApiProvider {
  id: string;
  type: ProviderType;
  name: string;
  description: string | null;
  address: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  isOpen: boolean | null;
  openingHours: string | null;
  category: string | null;
  rating: number | string | null;
  lat: number | string | null;
  lng: number | string | null;
  deliveryRadiusKm: number | string | null;
  distanceKm?: number;
}

interface ApiProduct {
  id: string;
  providerId: string;
  name: string;
  description: string | null;
  price: number | string;
  imageUrl: string | null;
  category: string | null;
}

interface ApiService {
  id: string;
  providerId: string;
  name: string;
  description: string | null;
  priceRange: string | null;
  duration: string | null;
  category: string | null;
}

interface ApiCategory {
  id: string;
  name: string;
}

/** A finite number, or null for a missing or unreadable one (never 0 by accident). */
function numberOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function placeholderImage(name: string) {
  return `https://placehold.co/600x400.png?text=${encodeURIComponent(name)}`;
}

function providerFields(p: ApiProvider) {
  const location: ProviderLocation = {
    address: p.address ?? "",
    lat: numberOrNull(p.lat),
    lng: numberOrNull(p.lng),
  };
  // A point needs both halves.
  if (location.lat === null || location.lng === null) {
    location.lat = null;
    location.lng = null;
  }
  return {
    id: p.id,
    type: p.type,
    name: p.name,
    description: p.description ?? "",
    imageUrl: p.coverUrl || p.avatarUrl || placeholderImage(p.name),
    rating: numberOrNull(p.rating) ?? 0,
    isOpen: p.isOpen ?? true,
    openingHours: p.openingHours?.trim() ?? "",
    location,
    deliveryRadiusKm: numberOrNull(p.deliveryRadiusKm),
    ...(typeof p.distanceKm === "number" ? { distanceKm: p.distanceKm } : {}),
  };
}

export function toStore(p: ApiProvider): Store {
  return { ...providerFields(p), category: p.category ?? "" };
}

export function toServiceProvider(p: ApiProvider): ServiceProvider {
  return { ...providerFields(p), serviceCategory: p.category ?? "" };
}

/** Stores and restaurants are both shops customers order from; the website lists them together. */
export function isShop(p: { type: ProviderType }) {
  return p.type !== "service";
}

export function fetchProviders(): Promise<{ stores: Store[]; serviceProviders: ServiceProvider[] }> {
  return fetchProviderList({});
}

export async function fetchServiceCategories(): Promise<ServiceCategory[]> {
  const categories = await apiGet<ApiCategory[]>("/api/categories");
  return (Array.isArray(categories) ? categories : []).map((c) => ({
    id: c.id,
    name: c.name,
    icon: categoryIcon(c.id),
  }));
}

/**
 * Every kind of provider, optionally in one category (the server also matches its aliases,
 * "Grocery" for groceries). With `near`, only those whose delivery radius reaches that point,
 * nearest first. Callers pass the rounded point (hooks/useNearby.ts), never the raw one.
 */
export async function fetchProviderList(
  { category, near }: { category?: string; near?: Coords | null },
  signal?: AbortSignal,
): Promise<{ stores: Store[]; serviceProviders: ServiceProvider[] }> {
  const query = [
    category ? `category=${encodeURIComponent(category)}` : null,
    near ? `lat=${near.lat}&lng=${near.lng}` : null,
  ].filter(Boolean);
  const providers = await apiGet<ApiProvider[]>(
    query.length ? `/api/providers?${query.join("&")}` : "/api/providers",
    { signal },
  );
  const list = Array.isArray(providers) ? providers : [];
  return {
    stores: list.filter(isShop).map(toStore),
    serviceProviders: list.filter((p) => !isShop(p)).map(toServiceProvider),
  };
}

export async function fetchProvider(id: string, signal?: AbortSignal): Promise<ApiProvider> {
  return apiGet<ApiProvider>(`/api/providers/${encodeURIComponent(id)}`, { signal });
}

export async function fetchProducts(providerId: string, signal?: AbortSignal): Promise<Product[]> {
  const products = await apiGet<ApiProduct[]>(
    `/api/providers/${encodeURIComponent(providerId)}/products`,
    { signal },
  );
  return (Array.isArray(products) ? products : []).map((p) => ({
    id: p.id,
    name: p.name,
    price: numberOrNull(p.price) ?? 0,
    category: p.category ?? "",
    imageUrl: p.imageUrl ?? "",
    description: p.description ?? "",
    storeId: p.providerId,
  }));
}

export async function fetchServices(providerId: string, signal?: AbortSignal): Promise<Service[]> {
  const services = await apiGet<ApiService[]>(
    `/api/providers/${encodeURIComponent(providerId)}/services`,
    { signal },
  );
  return (Array.isArray(services) ? services : []).map((s) => ({
    id: s.id,
    providerId: s.providerId,
    name: s.name,
    description: s.description ?? "",
    priceRange: s.priceRange?.trim() || "Price on request",
    duration: s.duration?.trim() ?? "",
    category: s.category ?? "",
  }));
}
