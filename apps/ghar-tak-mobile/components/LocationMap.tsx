import { Feather } from "@expo/vector-icons";
import type { Coords } from "@workspace/geo";
import React, { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import MapView, { PROVIDER_GOOGLE, type Region } from "react-native-maps";

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

/**
 * A map with a fixed pin drawn over its middle: the person moves the map under the pin.
 * Android draws Google Maps, iOS Apple Maps.
 */
export default function LocationMap({ start, target, onMoveEnd }: LocationMapProps) {
  const colors = useColors();
  const mapRef = useRef<MapView>(null);
  const [initialRegion] = useState(() => toRegion(start));
  const ready = useRef(false);
  // A target asked for before the map could animate.
  const pending = useRef<MapSpot | null>(null);
  // Apple Maps never reports `isGesture` (react-native-maps fills it in for Google Maps only),
  // so a touch on the map since the last programmatic move also counts as the person's move.
  const touched = useRef(false);

  useEffect(() => {
    if (!target) return;
    touched.current = false;
    if (!ready.current) {
      pending.current = target;
      return;
    }
    mapRef.current?.animateToRegion(toRegion(target), ANIMATION_MS);
  }, [target]);

  return (
    <View
      style={styles.frame}
      onTouchStart={() => {
        touched.current = true;
      }}
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
        onRegionChangeComplete={(region, details) => {
          onMoveEnd({ lat: region.latitude, lng: region.longitude }, details?.isGesture === true || touched.current);
        }}
      />
      {/* Drawn over the map, not a Marker: the map moves under it, so its tip is always the centre. */}
      <View pointerEvents="none" style={styles.pin}>
        <Feather name="map-pin" size={PIN_SIZE} color={colors.primary} />
      </View>
    </View>
  );
}

const PIN_SIZE = 40;

const styles = StyleSheet.create({
  frame: { flex: 1, minHeight: 220, overflow: "hidden" },
  pin: {
    position: "absolute",
    left: "50%",
    top: "50%",
    marginLeft: -PIN_SIZE / 2,
    // The tip of Feather's map-pin is 23/24 of the way down the icon.
    marginTop: -Math.round((PIN_SIZE * 23) / 24),
  },
});
