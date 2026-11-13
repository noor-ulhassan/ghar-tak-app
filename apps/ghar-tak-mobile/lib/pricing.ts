// Prices are in PKR, shown the way the website shows them (apps/ghar-tak ProductCard and checkout).

/** The website's checkout delivery fee and the subtotal from which delivery is free. */
export const DELIVERY_FEE = 50;
export const FREE_DELIVERY_THRESHOLD = 1500;

export function formatPKR(amount: number | string): string {
  return `PKR ${Number(amount ?? 0).toFixed(2)}`;
}

export function deliveryFeeFor(subtotal: number): number {
  return subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
}
