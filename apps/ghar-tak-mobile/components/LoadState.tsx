import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { useThemedStyles } from "@/hooks/useThemedStyles";

/** A centred spinner with a short line under it. */
export function LoadingBlock({ label }: { label: string }) {
  const colors = useColors();
  const styles = useLoadStyles();
  return (
    <View style={styles.block}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

/** What failed, why, and a Retry button. */
export function LoadError({
  title,
  message,
  onRetry,
  retrying = false,
}: {
  title: string;
  message?: string | null;
  onRetry: () => void;
  retrying?: boolean;
}) {
  const colors = useColors();
  const styles = useLoadStyles();
  return (
    <View style={styles.block}>
      <Feather name="wifi-off" size={36} color={colors.mutedForeground} />
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.muted}>{message}</Text> : null}
      <Pressable
        style={[styles.retryBtn, retrying && styles.retryBtnBusy]}
        onPress={onRetry}
        disabled={retrying}
        accessibilityRole="button"
      >
        {retrying ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Feather name="refresh-cw" size={14} color="#fff" />
        )}
        <Text style={styles.retryText}>{retrying ? "Trying again…" : "Retry"}</Text>
      </Pressable>
    </View>
  );
}

/**
 * The catalogue's state for list screens: a spinner on first load, an error with
 * Retry when nothing could be loaded, or a small note when the server can't be
 * reached and the last saved list is showing. Renders nothing when all is well.
 */
export function CatalogNotice() {
  const colors = useColors();
  const styles = useLoadStyles();
  const { loading, ready, error, showingSaved, refreshing, refresh } = useData();

  if (loading) return <LoadingBlock label="Loading shops…" />;

  if (!ready && error) {
    return (
      <LoadError
        title="Couldn't load shops"
        message={error}
        onRetry={() => void refresh()}
        retrying={refreshing}
      />
    );
  }

  if (showingSaved) {
    return (
      <View style={styles.savedNote}>
        <Feather name="clock" size={14} color={colors.mutedForeground} />
        <Text style={styles.savedText}>Showing your last saved list.</Text>
        <Pressable onPress={() => void refresh()} disabled={refreshing} accessibilityRole="button">
          {refreshing ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={styles.savedRetry}>Retry</Text>
          )}
        </Pressable>
      </View>
    );
  }

  return null;
}

function useLoadStyles() {
  const colors = useColors();
  return useThemedStyles(() => StyleSheet.create({
    block: { alignItems: "center", justifyContent: "center", paddingVertical: 40, paddingHorizontal: 24, gap: 10 },
    title: { fontSize: 16, color: colors.foreground, fontFamily: "Inter_600SemiBold", textAlign: "center" as const },
    muted: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" as const },
    retryBtn: {
      marginTop: 6,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 18,
      paddingVertical: 10,
    },
    retryBtnBusy: { opacity: 0.7 },
    retryText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
    savedNote: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.secondary,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 12,
    },
    savedText: { flex: 1, fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    savedRetry: { fontSize: 13, color: colors.primary, fontFamily: "Inter_600SemiBold" },
  }));
}
