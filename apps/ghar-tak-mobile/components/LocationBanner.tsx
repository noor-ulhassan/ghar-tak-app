import { Feather } from "@expo/vector-icons";
import { isApproximate } from "@workspace/geo";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { openLocationScreen } from "@/components/NearbyScope";
import { useColors } from "@/hooks/useColors";
import { useLocation } from "@/hooks/useLocation";
import { useThemedStyles } from "@/hooks/useThemedStyles";

/** The Home line that says which location the lists are for, with a way to change it (the website's LocationDisplay). */
export function LocationBanner() {
  const colors = useColors();
  const { location, source, accuracyM, place, loading } = useLocation();

  const rough = location !== null && isApproximate(accuracyM);
  // Rounded up: "within about 2 km" would claim the precision the lists treat as exact.
  const roughKm = rough && accuracyM !== null ? Math.ceil(accuracyM / 1000) : null;
  const message = !location
    ? loading
      ? "Finding your location…"
      : "We don't know where you are, so every shop is shown. Set your location to see the ones that deliver to you."
    : rough
      ? place
        ? `Showing every shop, nearest to ${place} first. Pin your street to see the ones that deliver to you.`
        : `Your location is only approximate (within about ${roughKm} km), so every shop is shown, nearest first. Pin your location to see the ones that deliver to you.`
      : source === "chosen"
        ? "Showing the shops that deliver to the spot you pinned."
        : "Showing the shops that deliver to your current location.";
  const action = !location ? "Set your location" : rough ? "Pin your location" : "Change";
  const warn = (!location && !loading) || rough;

  const styles = useThemedStyles(() => StyleSheet.create({
    banner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    text: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    warning: { color: colors.warning },
    button: { paddingHorizontal: 6, paddingVertical: 6 },
    buttonText: { fontSize: 13, color: colors.primary, fontFamily: "Inter_600SemiBold" },
  }));

  return (
    <View style={styles.banner}>
      {loading && !location ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Feather name="map-pin" size={18} color={colors.primary} />
      )}
      <Text style={[styles.text, warn && styles.warning]} accessibilityLiveRegion="polite">
        {message}
      </Text>
      <Pressable
        style={styles.button}
        onPress={openLocationScreen}
        accessibilityRole="button"
        accessibilityLabel={action === "Change" ? "Change location" : action}
        // About 29 high with its padding: the slop brings its touch area to 48.
        hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
      >
        <Text style={styles.buttonText}>{action}</Text>
      </Pressable>
    </View>
  );
}
