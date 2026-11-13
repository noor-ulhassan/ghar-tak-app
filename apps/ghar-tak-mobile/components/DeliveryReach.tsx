import { Feather } from "@expo/vector-icons";
import { deliveryReach, formatDistance } from "@workspace/geo";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { openLocationScreen } from "@/components/NearbyScope";
import { useColors } from "@/hooks/useColors";
import { useLocation } from "@/hooks/useLocation";
import { useNearbyFilter } from "@/hooks/useNearby";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import type { Store, ServiceProvider } from "@/lib/data";

/**
 * "2.3 km away · delivers to your location", or that the customer is outside its area, like the
 * website's DeliveryReach. With an approximate location it says so instead of guessing either way.
 * Nothing when the customer's or the provider's location is unknown.
 */
export function DeliveryReach({ provider }: { provider: Store | ServiceProvider }) {
  const colors = useColors();
  const { point, approximate } = useNearbyFilter();
  const { place } = useLocation();
  const reach = deliveryReach(point, { ...provider.location, deliveryRadiusKm: provider.deliveryRadiusKm });

  const styles = useThemedStyles(() => StyleSheet.create({
    row: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 12 },
    body: { flex: 1, gap: 4 },
    text: { fontSize: 13, lineHeight: 18, fontFamily: "Inter_500Medium" },
    muted: { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    icon: { marginTop: 2 },
    line: { flex: 1 },
    link: { fontSize: 13, lineHeight: 18, color: colors.primary, fontFamily: "Inter_600SemiBold" },
  }));

  if (!reach) return null;
  const isService = provider.type === "service";

  if (approximate) {
    const check = `Pin your location to check ${isService ? "if it serves you" : "delivery"}`;
    return (
      <View style={styles.row}>
        <Feather name="navigation" size={15} color={colors.mutedForeground} style={styles.icon} />
        <View style={styles.body}>
          <Text style={[styles.text, styles.muted]}>
            About {formatDistance(reach.distanceKm)} away · {place ? `you picked ${place}` : "your location is approximate"}.
          </Text>
          <Pressable onPress={openLocationScreen} accessibilityRole="button" accessibilityLabel={check} hitSlop={6}>
            <Text style={styles.link}>{check}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // The distance is rounded for display, so one a little past the edge can read as equal to the radius.
  const justOutside = reach.distanceKm - reach.radiusKm < 0.1;
  const verdict = reach.reaches
    ? isService ? "serves your location" : "delivers to your location"
    : `${justOutside ? "just outside" : "outside"} its ${reach.radiusKm} km ${isService ? "service" : "delivery"} area`;
  const tone = reach.reaches ? colors.success : colors.warning;

  return (
    <View style={styles.row}>
      <Feather name="navigation" size={15} color={tone} style={styles.icon} />
      <Text style={[styles.text, styles.line, { color: tone }]}>
        {formatDistance(reach.distanceKm)} away · {verdict}
      </Text>
    </View>
  );
}
