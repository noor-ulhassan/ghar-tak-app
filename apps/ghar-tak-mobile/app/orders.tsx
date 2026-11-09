import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCart } from "@/context/CartContext";
import { useColors } from "@/hooks/useColors";
import { useThemedStyles } from "@/hooks/useThemedStyles";

const STATUS_COLORS: Record<string, string> = {
  placed: "#f59e0b",
  confirmed: "#3b82f6",
  delivered: "#22c55e",
};

const STATUS_LABELS: Record<string, string> = {
  placed: "Order Placed",
  confirmed: "Confirmed",
  delivered: "Delivered",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function OrdersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { orders } = useCart();

  const styles = useThemedStyles(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: isWeb ? 67 : insets.top + 12,
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      flex: 1,
      fontSize: 20,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
    },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 48 },
    emptyTitle: { fontSize: 18, fontWeight: "700" as const, color: colors.foreground, fontFamily: "Inter_700Bold", marginTop: 16 },
    emptyText: { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 8, textAlign: "center" as const },
    emptyBtn: {
      marginTop: 24,
      backgroundColor: colors.primary,
      paddingHorizontal: 28,
      paddingVertical: 13,
      borderRadius: 12,
    },
    emptyBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
    scroll: { flex: 1 },
    orderCard: {
      backgroundColor: colors.card,
      marginHorizontal: 16,
      marginTop: 12,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    orderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
    orderId: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    },
    statusText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
    orderDate: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
    itemRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
    itemName: { flex: 1, fontSize: 13, color: colors.foreground, fontFamily: "Inter_400Regular" },
    itemQtyPrice: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
    totalLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    totalValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: colors.primary },
    addressRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 8 },
    addressText: { flex: 1, fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", lineHeight: 17 },
    footer: { height: isWeb ? 24 : insets.bottom + 80 },
  }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={styles.title}>My Orders</Text>
      </View>

      {orders.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="shopping-bag" size={56} color={colors.mutedForeground} />
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptyText}>Place your first order from a local store.</Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.replace("/(tabs)/stores" as any)}>
            <Text style={styles.emptyBtnText}>Browse Stores</Text>
          </Pressable>
        </View>
      ) : (
        // Order history only grows, so only the orders near the screen are mounted.
        <FlatList
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          data={orders}
          keyExtractor={(order) => order.id}
          renderItem={({ item: order }) => {
            const statusColor = STATUS_COLORS[order.status] ?? "#f59e0b";
            return (
              <View style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.orderId}>Order {order.id.replace("order_", "#")}</Text>
                    <Text style={styles.orderDate}>{formatDate(order.placedAt)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                {order.items.map((item) => (
                  <View key={item.product.id} style={styles.itemRow}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.product.name}</Text>
                    <Text style={styles.itemQtyPrice}>
                      ×{item.quantity} · ${(item.product.price * item.quantity).toFixed(2)}
                    </Text>
                  </View>
                ))}

                <View style={styles.divider} />

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total paid</Text>
                  <Text style={styles.totalValue}>${order.total.toFixed(2)}</Text>
                </View>

                <View style={styles.addressRow}>
                  <Feather name="map-pin" size={13} color={colors.mutedForeground} />
                  <Text style={styles.addressText}>{order.address}</Text>
                </View>
              </View>
            );
          }}
          ListFooterComponent={<View style={styles.footer} />}
        />
      )}
    </View>
  );
}
