import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import type { LocationMapProps } from "./LocationMap";

// The web bundle gets this file instead of LocationMap.tsx: react-native-maps has no web
// support, and importing it here would break the web build. Only its types are imported above.

/** Whether this build draws a map the customer can move. */
export const HAS_MAP = false;

/** Stands where the map would be, and says how to choose a location without one. */
export default function LocationMap(_props: LocationMapProps) {
  const colors = useColors();
  const styles = useThemedStyles(() => StyleSheet.create({
    frame: {
      flex: 1,
      minHeight: 160,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      padding: 24,
      backgroundColor: colors.secondary,
    },
    text: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center" as const,
      maxWidth: 320,
    },
  }));

  return (
    <View style={styles.frame}>
      <Feather name="map" size={32} color={colors.mutedForeground} />
      <Text style={styles.text}>
        The map is only in the phone app. Here, pick your city or use your current location.
      </Text>
    </View>
  );
}
