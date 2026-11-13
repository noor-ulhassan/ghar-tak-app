import { describe, expect, it } from "vitest";
import {
  DEFAULT_DELIVERY_RADIUS_KM,
  deliveryReach,
  distanceKm,
  formatDistance,
  providerDistance,
  sortByDistance,
} from "./index";

// One degree of latitude along a meridian on a sphere of radius 6371 km.
const ONE_DEGREE_KM = (2 * Math.PI * 6371) / 360;

describe("distanceKm", () => {
  it("is zero between a point and itself", () => {
    expect(distanceKm({ lat: 31.5204, lng: 74.3587 }, { lat: 31.5204, lng: 74.3587 })).toBe(0);
  });

  it("measures one degree of latitude as about 111.19 km", () => {
    expect(distanceKm({ lat: 31, lng: 74 }, { lat: 32, lng: 74 })).toBeCloseTo(ONE_DEGREE_KM, 6);
  });

  it("gives the same distance in both directions", () => {
    const lahore = { lat: 31.5204, lng: 74.3587 };
    const karachi = { lat: 24.8607, lng: 67.0011 };
    expect(distanceKm(lahore, karachi)).toBeCloseTo(distanceKm(karachi, lahore), 9);
  });

  it("puts Lahore and Karachi about 1,030 km apart in a straight line", () => {
    const km = distanceKm({ lat: 31.5204, lng: 74.3587 }, { lat: 24.8607, lng: 67.0011 });
    expect(km).toBeGreaterThan(1020);
    expect(km).toBeLessThan(1040);
  });
});

describe("formatDistance", () => {
  it("shows short distances in metres, rounded to 50 m, never below 50 m", () => {
    expect(formatDistance(0)).toBe("50 m");
    expect(formatDistance(0.01)).toBe("50 m");
    expect(formatDistance(0.26)).toBe("250 m");
    expect(formatDistance(0.97)).toBe("950 m");
  });

  it("switches to km once the rounded distance reaches 1000 m", () => {
    expect(formatDistance(0.975)).toBe("1.0 km");
    expect(formatDistance(0.999)).toBe("1.0 km");
    expect(formatDistance(1)).toBe("1.0 km");
  });

  it("shows longer distances in km with one decimal", () => {
    expect(formatDistance(2.34)).toBe("2.3 km");
    expect(formatDistance(12)).toBe("12.0 km");
    expect(formatDistance(99.94)).toBe("99.9 km");
  });

  it("shows whole km from 100 km", () => {
    expect(formatDistance(99.96)).toBe("100 km");
    expect(formatDistance(1033.04)).toBe("1033 km");
  });
});

describe("providerDistance", () => {
  const origin = { lat: 31, lng: 74 };

  it("is null without an origin", () => {
    expect(providerDistance(null, { lat: 31, lng: 74 })).toBeNull();
  });

  it("is null when the provider has no map point", () => {
    expect(providerDistance(origin, { lat: null, lng: 74 })).toBeNull();
    expect(providerDistance(origin, { lat: 31 })).toBeNull();
  });

  it("measures from the origin to the provider", () => {
    expect(providerDistance(origin, { lat: 32, lng: 74 })).toBeCloseTo(ONE_DEGREE_KM, 6);
  });
});

describe("sortByDistance", () => {
  const origin = { lat: 31, lng: 74 };
  const far = { id: "far", lat: 33, lng: 74 };
  const near = { id: "near", lat: 31.1, lng: 74 };
  const unknown = { id: "unknown", lat: null, lng: null };

  it("puts the nearest first and providers without a map point last", () => {
    expect(sortByDistance([unknown, far, near], origin).map((p) => p.id)).toEqual(["near", "far", "unknown"]);
  });

  it("keeps the original order without an origin", () => {
    const items = [far, near];
    expect(sortByDistance(items, null)).toBe(items);
  });

  it("does not change the list it was given", () => {
    const items = [far, near];
    sortByDistance(items, origin);
    expect(items.map((p) => p.id)).toEqual(["far", "near"]);
  });
});

describe("deliveryReach", () => {
  const point = { lat: 31, lng: 74 };
  const north = (km: number) => ({ lat: 31 + km / ONE_DEGREE_KM, lng: 74 });

  it("uses the default radius when the provider has none", () => {
    expect(deliveryReach(point, north(DEFAULT_DELIVERY_RADIUS_KM - 0.01))).toMatchObject({
      reaches: true,
      radiusKm: DEFAULT_DELIVERY_RADIUS_KM,
    });
    expect(deliveryReach(point, north(DEFAULT_DELIVERY_RADIUS_KM + 0.01))?.reaches).toBe(false);
  });

  it("uses the provider's own radius", () => {
    expect(deliveryReach(point, { ...north(9.9), deliveryRadiusKm: 10 })).toMatchObject({ reaches: true, radiusKm: 10 });
    expect(deliveryReach(point, { ...north(2), deliveryRadiusKm: 1.5 })?.reaches).toBe(false);
  });

  it("gives the distance it measured", () => {
    expect(deliveryReach(point, north(3))?.distanceKm).toBeCloseTo(3, 9);
  });

  it("is null when either location is unknown", () => {
    expect(deliveryReach(null, north(1))).toBeNull();
    expect(deliveryReach(point, { lat: null, lng: null })).toBeNull();
  });
});
