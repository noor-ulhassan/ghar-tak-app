import { distanceKm, type Coords } from "@workspace/geo";
import React, { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import MapView, { PROVIDER_GOOGLE, type Details, type Region } from "react-native-maps";
import Svg, { Circle, Path } from "react-native-svg";

import { useColors } from "@/hooks/useColors";

// The phone version. LocationMap.web.tsx replaces this file in the web bundle, because
// react-native-maps has no web support; the location screen works the same without a map.

/** Whether this build draws a map the customer can move. */
export const HAS_MAP = true;

/** Where to show the map: a centre and how many degrees of latitude/longitude fit on screen. */
export interface MapSpot {
  point: Coords;
  delta: number;
}

export interface LocationMapProps {
  /** Where the map opens. Read once. */
  start: MapSpot;
  /** Each new object animates the map there (a city chip, "Use my current location"). */
  target: MapSpot | null;
  /** The centre each time the map comes to rest; `byUser` says whether the person moved it. */
  onMoveEnd: (center: Coords, byUser: boolean) => void;
}

const toRegion = ({ point, delta }: MapSpot): Region => ({
  latitude: point.lat,
  longitude: point.lng,
  latitudeDelta: delta,
  longitudeDelta: delta,
});

const ANIMATION_MS = 600;
// A zoom button, a tap or the map changing size keeps the centre (give or take rounding),
// so only a centre that moved further than this can be the person's move.
const MIN_MOVE_M = 2;

/**
 * A map with a fixed pin drawn over its middle: the person moves the map under the pin.
 * Android draws Google Maps, iOS Apple Maps. It fills its parent, which sets the height.
 */
export default function LocationMap({ start, target, onMoveEnd }: LocationMapProps) {
  const colors = useColors();
  const mapRef = useRef<MapView>(null);
  const [initialRegion] = useState(() => toRegion(start));
  const ready = useRef(false);
  // A target asked for before the map could animate.
  const pending = useRef<MapSpot | null>(null);
  // Apple Maps never reports `isGesture` (react-native-maps fills it in for Google Maps only),
  // so a finger on the map while it moves also marks the move as the person's.
  const touching = useRef(false);
  const touchedThisMove = useRef(false);
  // The last centre the map reported, to tell a real move from one that kept the centre.
  const lastCenter = useRef<Coords>(start.point);
  // Counts region events, so a centre read late (Android) gives way to a newer move.
  const regionEvents = useRef(0);

  useEffect(() => {
    if (!target) return;
    touchedThisMove.current = false;
    if (!ready.current) {
      pending.current = target;
      return;
    }
    mapRef.current?.animateToRegion(toRegion(target), ANIMATION_MS);
  }, [target]);

  const onRegionChange = () => {
    regionEvents.current += 1;
    if (touching.current) touchedThisMove.current = true;
  };

  const onRegionChangeComplete = async (region: Region, details: Details) => {
    const event = ++regionEvents.current;
    const byGesture = details?.isGesture === true || touchedThisMove.current || touching.current;
    touchedThisMove.current = false;

    let center: Coords = { lat: region.latitude, lng: region.longitude };
    if (Platform.OS === "android") {
      // Google Maps reports the middle of the visible bounds (OnRegionChangeEvent uses
      // bounds.getCenter()), which zoomed out is metres to kilometres from the camera's
      // target, the point under the pin.
      try {
        const camera = await mapRef.current?.getCamera();
        if (camera) center = { lat: camera.center.latitude, lng: camera.center.longitude };
      } catch {
        // Keep the region's centre.
      }
      if (event !== regionEvents.current) return;
    }

    const moved = distanceKm(lastCenter.current, center) * 1000 > MIN_MOVE_M;
    lastCenter.current = center;
    onMoveEnd(center, byGesture && moved);
  };

  const touchEnded = () => {
    touching.current = false;
  };

  return (
    <View
      style={styles.frame}
      onTouchStart={() => {
        touching.current = true;
      }}
      onTouchEnd={touchEnded}
      onTouchCancel={touchEnded}
      accessible
      accessibilityLabel="Map with a pin in the middle"
      accessibilityHint="Move the map so the pin sits on your home, or use the buttons below."
    >
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        // Google Maps on Android (Expo Go brings its own key); the default, Apple Maps, on iOS.
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        onMapReady={() => {
          ready.current = true;
          const next = pending.current;
          pending.current = null;
          if (next) mapRef.current?.animateToRegion(toRegion(next), ANIMATION_MS);
        }}
        onRegionChange={onRegionChange}
        onRegionChangeComplete={(region, details) => void onRegionChangeComplete(region, details)}
      />
      {/* Drawn over the map, not a Marker: the map moves under it, so its tip is always the centre. */}
      <View pointerEvents="none" style={styles.pin}>
        <Svg width={PIN_SIZE} height={PIN_SIZE} viewBox="0 0 24 24">
          {/* Feather's map-pin, filled: its tip is exactly at (12, 23). */}
          <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill={colors.primary} />
          <Circle cx={12} cy={10} r={3} fill={colors.primaryForeground} />
        </Svg>
      </View>
    </View>
  );
}

const PIN_SIZE = 40;

const styles = StyleSheet.create({
  frame: { flex: 1, overflow: "hidden" },
  pin: {
    position: "absolute",
    left: "50%",
    top: "50%",
    marginLeft: -PIN_SIZE / 2,
    // Puts the tip, 23/24 of the way down, on the map's centre.
    marginTop: -(PIN_SIZE * 23) / 24,
  },
});
