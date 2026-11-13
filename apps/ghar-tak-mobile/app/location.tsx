import { Feather } from "@expo/vector-icons";
import { CITIES, CITY_ACCURACY_M, type Coords } from "@workspace/geo";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoadingBlock } from "@/components/LoadState";
import LocationMap, { HAS_MAP, type MapSpot } from "@/components/LocationMap";
import { LINK_SLOP } from "@/components/NearbyScope";
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
// The map's height: tall enough to place the pin, short enough to leave room on a small phone.
const MAP_HEIGHT = 260;
const MAP_SHARE_OF_WINDOW = 0.4;

/** As the database keeps it: 7 decimals (about 1 cm), longitude wrapped into -180..180. */
function clean(point: Coords): Coords {
  const lng = ((((point.lng + 180) % 360) + 360) % 360) - 180;
  return { lat: Math.round(point.lat * 1e7) / 1e7, lng: Math.round(lng * 1e7) / 1e7 };
}

/** Where the map opens: the saved location, or all of Lahore. */
function startAt(location: Coords | null): MapSpot {
  return location ? { point: location, delta: STREET_DELTA } : { point: LAHORE, delta: START_DELTA };
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
  const { height: windowHeight } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const { location, status, chooseLocation, locateDevice } = useLocation();
  const savedLoading = status === "loading";
  const mapHeight = Math.min(MAP_HEIGHT, Math.round(windowHeight * MAP_SHARE_OF_WINDOW));

  // Read once the saved location has loaded: one saved while this screen is open doesn't move
  // the map under the person. On a web reload or a deep link the screen opens before it loads.
  const [start, setStart] = useState<MapSpot | null>(() => (savedLoading ? null : startAt(location)));
  const [point, setPoint] = useState<Coords | null>(() => (!savedLoading && location ? clean(location) : null));
  const [origin, setOrigin] = useState<PointOrigin>({ kind: "initial" });
  const [target, setTarget] = useState<MapSpot | null>(null);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // The phone won't show the permission prompt again: only its settings can allow location.
  const [needsSettings, setNeedsSettings] = useState(false);
  // Counts the person's choices, so a "Use my current location" answer that arrives after they
  // picked a city or moved the map doesn't replace it.
  const choice = useRef(0);

  useEffect(() => {
    if (savedLoading || start) return;
    setStart(startAt(location));
    if (location && origin.kind === "initial") setPoint(clean(location));
  }, [savedLoading, start, location, origin.kind]);

  // iOS has no live regions, so the note is read out when it appears. TalkBack reads the
  // live region by itself.
  useEffect(() => {
    if (note && Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(note);
  }, [note]);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const clearNote = () => {
    setNote(null);
    setNeedsSettings(false);
  };

  // The person chose something themselves: a device answer still on its way no longer counts.
  const supersedeLocating = () => {
    choice.current += 1;
    setLocating(false);
  };

  const pickCity = (city: (typeof CITIES)[number]) => {
    supersedeLocating();
    const spot = clean(city);
    setOrigin({ kind: "jump", city: city.name });
    setPoint(spot);
    setTarget({ point: spot, delta: CITY_DELTA });
    clearNote();
  };

  const locateMe = async () => {
    const request = ++choice.current;
    setLocating(true);
    clearNote();
    const fix = await locateDevice();
    if (request !== choice.current) return;
    setLocating(false);
    if (!fix.ok) {
      setNote(failureNote(fix.reason));
      setNeedsSettings(fix.reason === "denied" && !fix.canAskAgain && !isWeb);
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
      supersedeLocating();
      setOrigin({ kind: "moved" });
      setPoint(clean(center));
      clearNote();
    } else if (origin.kind === "moved") {
      // The map settled again on its own (a resize, say): the pin is still its centre.
      setPoint(clean(center));
    }
    // Otherwise a city or device placement is ending its animation: it keeps its exact point.
  };

  const openInGoogleMaps = (spot: Coords) => {
    Linking.openURL(`https://www.google.com/maps?q=${spot.lat},${spot.lng}`).catch(() => {
      // No browser or maps app could open it; the coordinates are on screen.
    });
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
    scroll: { flex: 1 },
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
      minHeight: 44,
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 22,
      paddingHorizontal: 14,
      backgroundColor: colors.background,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 13, color: colors.foreground, fontFamily: "Inter_500Medium" },
    chipTextActive: { color: "#fff" },
    panel: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 8 },
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
    settingsBtn: { alignSelf: "flex-start" as const, minHeight: 44, justifyContent: "center" },
    footer: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: isWeb ? 24 : insets.bottom + 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
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
      {/* Everything above the buttons scrolls, so they stay on screen on a small phone or with
          large text. The map takes its own pans: Android's map asks its parents not to scroll
          (react-native-maps MapView.dispatchTouchEvent), and on iOS the map's gestures win. */}
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable
            style={styles.closeBtn}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={5}
          >
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

        {start ? (
          <>
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
                    hitSlop={{ top: 2, bottom: 2 }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{city.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={{ height: mapHeight }}>
              <LocationMap start={start} target={target} onMoveEnd={onMoveEnd} />
            </View>

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
                    onPress={() => openInGoogleMaps(point)}
                    accessibilityRole="link"
                    accessibilityLabel="Check on Google Maps"
                    accessibilityHint="Opens the pin in Google Maps"
                    hitSlop={LINK_SLOP}
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
              {needsSettings ? (
                <Pressable
                  style={styles.settingsBtn}
                  onPress={() => {
                    Linking.openSettings().catch(() => {
                      // The note above already says where to turn it on.
                    });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Open settings"
                  hitSlop={{ left: 8, right: 8, top: 2, bottom: 2 }}
                >
                  <Text style={styles.link}>Open settings</Text>
                </Pressable>
              ) : null}
              {pickedCity ? (
                <Text style={styles.small}>
                  {`With just the city, every shop is listed, nearest to the middle of ${pickedCity} first. `}
                  {HAS_MAP
                    ? "Move the map to your street to see exactly who delivers to you."
                    : "Use your current location to see exactly who delivers to you."}
                </Text>
              ) : null}
            </View>
          </>
        ) : (
          <LoadingBlock label="Loading your location…" />
        )}
      </ScrollView>

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
  );
}
