import type { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";

// The app's catalogue types. lib/db.ts maps the Ghar Tak API's providers, products,
// services and categories onto them.

export type ProviderType = "store" | "service" | "restaurant";

export interface ProviderLocation {
  address: string;
  /** Null when the provider has not set a map point. */
  lat: number | null;
  lng: number | null;
}

interface ProviderBase {
  id: string;
  type: ProviderType;
  name: string;
  description: string;
  imageUrl: string;
  rating: number;
  /** The owner's open/closed switch. */
  isOpen: boolean;
  /** Free text such as "Mon-Sat 8am-9pm"; empty when not set. */
  openingHours: string;
  location: ProviderLocation;
  /** Null means the default radius (DEFAULT_DELIVERY_RADIUS_KM). */
  deliveryRadiusKm: number | null;
  /** Only sent when the list was asked for a customer location. */
  distanceKm?: number;
}

/** A store or restaurant: something customers order products from. */
export interface Store extends ProviderBase {
  category: string;
}

/** A provider customers book services from. */
export interface ServiceProvider extends ProviderBase {
  /** Free text the owner typed, e.g. "plumber" or "Tutor". */
  serviceCategory: string;
}

export interface Product {
  id: string;
  name: string;
  /** PKR. */
  price: number;
  category: string;
  imageUrl: string;
  description?: string;
  storeId?: string;
}

/** A bookable service a provider lists. */
export interface Service {
  id: string;
  providerId: string;
  name: string;
  description: string;
  /** Free text such as "PKR 500 - 1,500". */
  priceRange: string;
  duration: string;
  category: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  icon: FeatherIconName;
}

export type FeatherIconName = ComponentProps<typeof Feather>["name"];

/** The radius the server uses when a provider has not set one (@workspace/geo). */
export const DEFAULT_DELIVERY_RADIUS_KM = 5;

export function deliveryRadiusLabel(radiusKm: number | null): string {
  return `Delivers within ${radiusKm ?? DEFAULT_DELIVERY_RADIUS_KM} km`;
}

/** "Open · Mon-Sat 8am-9pm", "Closed", ... */
export function openStatusLabel(provider: Pick<ProviderBase, "isOpen" | "openingHours">): string {
  const status = provider.isOpen ? "Open" : "Closed";
  return provider.openingHours ? `${status} · ${provider.openingHours}` : status;
}

// The API sends lucide icon names; the app draws Feather icons, so known categories get their own.
const CATEGORY_ICONS: Record<string, FeatherIconName> = {
  plumber: "droplet",
  electrician: "zap",
  cleaner: "wind",
  mechanic: "settings",
  painter: "pen-tool",
  carpenter: "tool",
  tutor: "book-open",
  driver: "truck",
  groceries: "shopping-cart",
  electronics: "cpu",
  pharmacy: "plus-square",
  restaurant: "coffee",
  bakery: "gift",
  clothing: "tag",
};

export function categoryIcon(categoryId: string): FeatherIconName {
  return CATEGORY_ICONS[categoryId] ?? "grid";
}

/**
 * The display name for a provider's free-text category: the official category's
 * name when it matches one by id or name, otherwise the text itself, tidied up.
 */
export function categoryLabel(raw: string, categories: ServiceCategory[]): string {
  const wanted = raw.trim().toLowerCase();
  if (!wanted) return "";
  const official = categories.find((c) => c.id === wanted || c.name.toLowerCase() === wanted);
  if (official) return official.name;
  const text = raw.trim().replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
