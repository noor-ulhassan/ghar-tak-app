import { Feather } from "@expo/vector-icons";
import { CITIES, CITY_ACCURACY_M, type Coords } from "@workspace/geo";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import LocationMap, { HAS_MAP, type MapSpot } from "@/components/LocationMap";
import { useColors } from "@/hooks/useColors";
import { useLocation } from "@/hooks/useLocation";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import type { DeviceFix } from "@/lib/location";

/** How the point on the map came to be chosen; it decides how the point is saved (the website's PointOrigin). */
type PointOrigin =
  /** The screen opened on the saved location and nobody has chosen anything since. */
  | { kind: "initial" }
  /** The person moved the map. */
  | { kind: "moved" }
  /** "Use my current location" placed it, and the map hasn't been moved since. */
  | { kind: "device"; accuracyM: number | null }
  /** A city chip placed it, and the map hasn't been moved since. */
  | { kind: "jump"; city: string };

// Where the map opens when nothing is saved.
const LAHORE: Coords = { lat: 31.5204, lng: 74.3587 };
// How much of the map shows, in degrees: a few streets, a device fix, a city, all of Lahore.
const STREET_DELTA = 0.005;
const DEVICE_DELTA = 0.003;
const CITY_DELTA = 0.15;
const START_DELTA = 0.08;

/** As the database keeps it: 7 decimals (about 1 cm), longitude wrapped into -180..180. */
function clean(point: Coords): Coords {
  const lng = ((((point.lng + 180) % 360) + 360) % 360) - 180;
  return { lat: Math.round(point.lat * 1e7) / 1e7, lng: Math.round(lng * 1e7) / 1e7 };
}

// Without a map (the web build) the only other way to choose is a city.
const OR_INSTEAD = HAS_MAP ? "move the map to the right spot instead" : "pick your city instead";

function failureNote(reason: Extract<DeviceFix, { ok: false }>["reason"]): string {
  if (reason === "denied") {
    const where = Platform.OS === "web" ? "your browser's" : "your phone's";
    return `Location permission is turned off. Turn it on in ${where} settings, or ${OR_INSTEAD}.`;
  }
  if (reason === "timeout") return `Finding your location took too long. Try again, or ${OR_INSTEAD}.`;
  return `Couldn't get your location. Check that location is switched on, or ${OR_INSTEAD}.`;
}

function accuracyNote(metres: number | null): string {
  if (metres === null) {
    return HAS_MAP ? "Placed at your current location. Check that the pin is on the right spot." : "Found your current location.";
  }
  if (metres > 100) {
    const within = metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${metres} m`;
    return `Your device only knows this to within about ${within}.${HAS_MAP ? " Move the map so the pin sits exactly on the right spot." : ""}`;
  }
  return `Placed to within about ${metres} m.${HAS_MAP ? " Check that the pin is on the right spot." : ""}`;
}

/**
 * Where the customer sets their location, so the "near me" lists show the shops that reach them
 * (the website's LocationChooser). Nothing is chosen until the person moves the map, picks a city
 * or uses their current location, so an untouched map never saves the place it opened at.
 */
export default function LocationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { location, chooseLocation, locateDevice } = useLocation();

  // Read once: a location saved while this screen is open doesn't move the map under the person.
  const [start] = useState<MapSpot>(() =>
    location ? { point: location, delta: STREET_DELTA } : { point: LAHORE, delta: START_DELTA },
  );
  const [point, setPoint] = useState<Coords | null>(() => (location ? clean(location) : null));
  const [origin, setOrigin] = useState<PointOrigin>({ kind: "initial" });
  const [target, setTarget] = useState<MapSpot | null>(null);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // iOS has no live regions, so the note is read out when it appears.
  useEffect(() => {
    if (note) AccessibilityInfo.announceForAccessibility(note);
  }, [note]);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const pickCity = (city: (typeof CITIES)[number]) => {
    const spot = clean(city);
    setOrigin({ kind: "jump", city: city.name });
    setPoint(spot);
    setTarget({ point: spot, delta: CITY_DELTA });
    setNote(null);
  };

  const locateMe = async () => {
    setLocating(true);
    setNote(null);
    const fix = await locateDevice();
    setLocating(false);
    if (!fix.ok) {
      setNote(failureNote(fix.reason));
      return;
    }
    const spot = clean(fix.point);
    setOrigin({ kind: "device", accuracyM: fix.accuracyM });
    setPoint(spot);
    setTarget({ point: spot, delta: DEVICE_DELTA });
    setNote(accuracyNote(fix.accuracyM));
  };

  const onMoveEnd = (center: Coords, byUser: boolean) => {
    if (byUser) {
      setOrigin({ kind: "moved" });
      setPoint(clean(center));
      setNote(null);
    } else if (origin.kind === "moved") {
      // The map settled again on its own (a resize, say): the pin is still its centre.
      setPoint(clean(center));
    }
    // Otherwise a city or device placement is ending its animation: it keeps its exact point.
  };

  const save = () => {
    if (!point) return;
    if (origin.kind === "device") {
      // A device reading kept as it was stays one: refreshed daily, flagged when vague.
      chooseLocation(point, { source: "device", accuracyM: origin.accuracyM });
    } else if (origin.kind === "jump") {
      // A city on its own is too vague to say who delivers, so the lists sort by it instead.
      chooseLocation(point, { source: "chosen", accuracyM: CITY_ACCURACY_M, place: origin.city });
    } else if (origin.kind === "moved") {
      chooseLocation(point, { source: "chosen" });
    }
    // 'initial': nobody chose anything, so the saved location stays exactly as it was.
    close();
  };

  const pickedCity = origin.kind === "jump" ? origin.city : null;

  const styles = useThemedStyles(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      // An iOS modal sheet already sits below the status bar.
      paddingTop: isWeb ? 67 : Platform.OS === "ios" ? 16 : insets.top + 12,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    closeBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontSize: 20, fontWeight: "700" as const, color: colors.foreground, fontFamily: "Inter_700Bold" },
    intro: {
      paddingHorizontal: 16,
      fontSize: 13,
      lineHeight: 18,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    cities: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: colors.background,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 13, color: colors.foreground, fontFamily: "Inter_500Medium" },
    chipTextActive: { color: "#fff" },
    panel: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: isWeb ? 24 : insets.bottom + 12,
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    locateBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 10,
    },
    locateText: { fontSize: 14, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    readout: { flexDirection: "row", flexWrap: "wrap" as const, alignItems: "center", gap: 4 },
    small: { fontSize: 12, lineHeight: 17, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    link: { fontSize: 12, lineHeight: 17, color: colors.primary, fontFamily: "Inter_600SemiBold" },
    footer: { flexDirection: "row", gap: 10, marginTop: 4 },
    cancelBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: "center",
    },
    cancelText: { fontSize: 15, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    saveBtn: { flex: 2, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
    saveBtnDisabled: { opacity: 0.5 },
    saveText: { fontSize: 15, color: "#fff", fontFamily: "Inter_600SemiBold" },
  }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.closeBtn} onPress={close} accessibilityRole="button" accessibilityLabel="Cancel">
          <Feather name="x" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Set your location
        </Text>
      </View>
      <Text style={styles.intro}>
        {HAS_MAP
          ? "We list the shops and services that reach this spot. Pick your city, then move the map to your street."
          : "We list the shops and services that reach this spot. Pick your city, or use your current location."}
      </Text>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cities}>
          {CITIES.map((city) => {
            const active = pickedCity === city.name;
            return (
              <Pressable
                key={city.name}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => pickCity(city)}
                accessibilityRole="button"
                accessibilityLabel={`Go to ${city.name}`}
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{city.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <LocationMap start={start} target={target} onMoveEnd={onMoveEnd} />

      <View style={styles.panel}>
        <Pressable
          style={styles.locateBtn}
          onPress={() => void locateMe()}
          disabled={locating}
          accessibilityRole="button"
          accessibilityLabel="Use my current location"
          accessibilityState={{ disabled: locating, busy: locating }}
        >
          {locating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name="crosshair" size={16} color={colors.foreground} />
          )}
          <Text style={styles.locateText}>{locating ? "Finding your location…" : "Use my current location"}</Text>
        </Pressable>

        {point ? (
          <View style={styles.readout}>
            <Text style={styles.small}>
              Pin at {point.lat.toFixed(5)}, {point.lng.toFixed(5)} ·
            </Text>
            <Pressable
              onPress={() => void Linking.openURL(`https://www.google.com/maps?q=${point.lat},${point.lng}`)}
              accessibilityRole="link"
              accessibilityLabel="Check the pin on Google Maps"
              hitSlop={6}
            >
              <Text style={styles.link}>Check on Google Maps</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.small}>
            {HAS_MAP
              ? "No pin yet: move the map to the right spot."
              : "No location yet: pick your city or use your current location."}
          </Text>
        )}

        {note ? (
          <Text style={styles.small} accessibilityLiveRegion="polite">
            {note}
          </Text>
        ) : null}
        {pickedCity ? (
          <Text style={styles.small}>
            {`With just the city, every shop is listed, nearest to the middle of ${pickedCity} first. `}
            {HAS_MAP
              ? "Move the map to your street to see exactly who delivers to you."
              : "Use your current location to see exactly who delivers to you."}
          </Text>
        ) : null}

        <View style={styles.footer}>
          <Pressable style={styles.cancelBtn} onPress={close} accessibilityRole="button" accessibilityLabel="Cancel">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.saveBtn, !point && styles.saveBtnDisabled]}
            onPress={save}
            disabled={!point}
            accessibilityRole="button"
            accessibilityLabel="Use this location"
            accessibilityState={{ disabled: !point }}
          >
            <Text style={styles.saveText}>Use this location</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
