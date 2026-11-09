import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBookings, type ServiceBooking } from "@/context/BookingsContext";
import { useColors } from "@/hooks/useColors";
import { useThemedStyles } from "@/hooks/useThemedStyles";

const STATUS_COLORS: Record<ServiceBooking["status"], string> = {
  pending: "#f59e0b",
  cancelled: "#71717a",
};

const STATUS_LABELS: Record<ServiceBooking["status"], string> = {
  pending: "Pending",
  cancelled: "Cancelled",
};

function formatDate(iso: string) {
  const d = new Date(`${iso}T09:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function BookingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { bookings, cancelBooking } = useBookings();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const styles = useThemedStyles(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: isWeb ? 67 : insets.top + 12,
      paddingHorizontal: 16,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { fontSize: 18, fontWeight: "700" as const, color: colors.foreground, fontFamily: "Inter_700Bold" },
    content: { padding: 16 },
    separator: { height: 12 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 8,
    },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
    provider: { fontSize: 16, fontWeight: "700" as const, color: colors.foreground, fontFamily: "Inter_700Bold", flex: 1 },
    service: { fontSize: 14, color: colors.primary, fontFamily: "Inter_600SemiBold" },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    meta: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", flex: 1 },
    notes: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      fontStyle: "italic" as const,
    },
    cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
    statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
    statusText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
    price: { fontSize: 13, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    cancelBtn: { alignSelf: "flex-start", paddingVertical: 6 },
    cancelText: { fontSize: 13, color: colors.destructive, fontFamily: "Inter_600SemiBold" },
    empty: { alignItems: "center", padding: 40, gap: 12 },
    emptyTitle: { fontSize: 17, fontWeight: "600" as const, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    emptySub: { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" as const },
    browseBtn: {
      marginTop: 4,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 24,
    },
    browseText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
    footer: { height: isWeb ? 34 : insets.bottom + 20 },
  }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={styles.headerTitle}>My Bookings</Text>
      </View>

      {/* Bookings only grow over time, so only the ones near the screen are mounted. */}
      <FlatList
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        data={bookings}
        keyExtractor={(booking) => booking.id}
        extraData={confirmId}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="calendar" size={44} color={colors.mutedForeground} />
            <Text style={styles.emptyTitle}>No bookings yet</Text>
            <Text style={styles.emptySub}>
              Book a plumber, cleaner or any local professional and it will show up here.
            </Text>
            <Pressable style={styles.browseBtn} onPress={() => router.push("/(tabs)/services")}>
              <Text style={styles.browseText}>Browse Services</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item: booking }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.provider} numberOfLines={1}>{booking.providerName}</Text>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[booking.status] + "20" }]}>
                <Text style={[styles.statusText, { color: STATUS_COLORS[booking.status] }]}>
                  {STATUS_LABELS[booking.status]}
                </Text>
              </View>
            </View>

            <Text style={styles.service}>{booking.serviceName}</Text>

            <View style={styles.metaRow}>
              <Feather name="calendar" size={14} color={colors.mutedForeground} />
              <Text style={styles.meta}>{formatDate(booking.date)} • {booking.timeSlot}</Text>
            </View>
            <View style={styles.metaRow}>
              <Feather name="map-pin" size={14} color={colors.mutedForeground} />
              <Text style={styles.meta} numberOfLines={2}>{booking.address}</Text>
            </View>
            {booking.notes ? (
              <View style={styles.metaRow}>
                <Feather name="file-text" size={14} color={colors.mutedForeground} />
                <Text style={styles.notes} numberOfLines={2}>{booking.notes}</Text>
              </View>
            ) : null}

            <View style={styles.cardBottom}>
              <Text style={styles.price}>{booking.priceRange}</Text>
            </View>

            {booking.status === "pending" && (
              <Pressable
                style={styles.cancelBtn}
                onPress={() => {
                  if (confirmId === booking.id) {
                    cancelBooking(booking.id);
                    setConfirmId(null);
                  } else {
                    setConfirmId(booking.id);
                  }
                }}
              >
                <Text style={styles.cancelText}>
                  {confirmId === booking.id ? "Tap again to confirm cancel" : "Cancel booking"}
                </Text>
              </Pressable>
            )}
          </View>
        )}
        ListFooterComponent={<View style={styles.footer} />}
      />
    </View>
  );
}
