import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LoadError, LoadingBlock } from "@/components/LoadState";
import { useColors } from "@/hooks/useColors";
import { useLocation } from "@/hooks/useLocation";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import { ApiError } from "@/lib/api";

/** Opens the screen where the customer sets their location (app/location.tsx). */
export function openLocationScreen() {
  router.push("/location");
}

/**
 * The line under a "near me" list's title, like the website's NearbyScopeSwitch. With an
 * approximate location there is nothing to switch: everything is listed, nearest first,
 * and the customer is asked to pin their location.
 */
export function NearbyScopeLine({
  showAll,
  approximate,
  onShowAll,
}: {
  showAll: boolean;
  approximate: boolean;
  onShowAll: (on: boolean) => void;
}) {
  const { place } = useLocation();
  const styles = useScopeStyles();

  if (approximate) {
    return (
      <View style={styles.line}>
        <Text style={[styles.text, styles.warning]}>
          {place
            ? `You picked ${place}, so everything is shown, nearest first.`
            : "Your location is only approximate, so everything is shown, nearest first."}
        </Text>
        <View style={styles.actions}>
          <LinkButton
            label="Pin your location"
            a11yLabel="Pin your location to see the ones that reach you"
            onPress={openLocationScreen}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.line}>
      <Text style={styles.text}>
        {showAll ? "Showing all, near and far." : "Showing only those that reach your location."}
      </Text>
      <View style={styles.actions}>
        <LinkButton
          label={showAll ? "Show only those near me" : "Show all"}
          onPress={() => onShowAll(!showAll)}
        />
        <Text style={styles.text} accessibilityElementsHidden importantForAccessibility="no">
          ·
        </Text>
        <LinkButton label="Change location" onPress={openLocationScreen} />
      </View>
    </View>
  );
}

/** A near-me request that is still loading or failed, or null once it has a list (which may be empty). */
export function NearRequestState({
  near,
  what,
}: {
  near: { loading: boolean; error: unknown; retry: () => void; retrying: boolean };
  /** "stores", "service providers", ... */
  what: string;
}) {
  if (near.loading) return <LoadingBlock label={`Finding ${what} near you…`} />;
  if (near.error) {
    return (
      <LoadError
        title={`Couldn't load the ${what} near you`}
        message={near.error instanceof ApiError ? near.error.message : null}
        onRetry={near.retry}
        retrying={near.retrying}
      />
    );
  }
  return null;
}

/** What a "near me" list shows when nothing reaches the customer (never for a failed request). */
export function NoneNearby({
  message,
  allLabel,
  onAll,
}: {
  message: string;
  allLabel: string;
  onAll: () => void;
}) {
  const colors = useColors();
  const styles = useScopeStyles();
  return (
    <View style={styles.none}>
      <Feather name="map-pin" size={36} color={colors.mutedForeground} />
      <Text style={styles.noneText}>{message}</Text>
      <View style={styles.noneActions}>
        <Pressable style={styles.outlineBtn} onPress={onAll} accessibilityRole="button" accessibilityLabel={allLabel}>
          <Text style={styles.outlineBtnText}>{allLabel}</Text>
        </Pressable>
        <Pressable
          style={styles.ghostBtn}
          onPress={openLocationScreen}
          accessibilityRole="button"
          accessibilityLabel="Change my location"
        >
          <Text style={styles.ghostBtnText}>Change my location</Text>
        </Pressable>
      </View>
    </View>
  );
}

function LinkButton({ label, a11yLabel, onPress }: { label: string; a11yLabel?: string; onPress: () => void }) {
  const styles = useScopeStyles();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11yLabel ?? label} hitSlop={8}>
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

function useScopeStyles() {
  const colors = useColors();
  return useThemedStyles(() => StyleSheet.create({
    line: { gap: 4, marginBottom: 12 },
    text: { fontSize: 13, lineHeight: 18, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    warning: { color: colors.warning },
    actions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" as const, gap: 8 },
    link: { fontSize: 13, lineHeight: 18, color: colors.primary, fontFamily: "Inter_600SemiBold" },
    none: { alignItems: "center", paddingVertical: 32, paddingHorizontal: 16, gap: 12 },
    noneText: {
      fontSize: 15,
      color: colors.mutedForeground,
      fontFamily: "Inter_500Medium",
      textAlign: "center" as const,
    },
    noneActions: { flexDirection: "row", flexWrap: "wrap" as const, justifyContent: "center", gap: 8 },
    outlineBtn: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    outlineBtnText: { fontSize: 14, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    ghostBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
    ghostBtnText: { fontSize: 14, color: colors.primary, fontFamily: "Inter_600SemiBold" },
  }));
}
