import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCart } from "@/context/CartContext";
import { useColors } from "@/hooks/useColors";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import { deliveryFeeFor, formatPKR, FREE_DELIVERY_THRESHOLD } from "@/lib/pricing";

export default function CartScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { items, removeItem, updateQuantity, totalItems, totalPrice } = useCart();
  const deliveryFee = deliveryFeeFor(totalPrice);
  const grandTotal = totalPrice + deliveryFee;

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
    content: { flex: 1 },
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
    itemCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      marginHorizontal: 16,
      marginTop: 12,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    itemInfo: { flex: 1 },
    itemName: { fontSize: 15, color: colors.foreground, fontFamily: "Inter_500Medium" },
    itemStore: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    itemPrice: { fontSize: 14, color: colors.primary, fontFamily: "Inter_700Bold", marginTop: 4 },
    qtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    qtyBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    qtyBtnDisabled: { opacity: 0.5 },
    qtyText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground, minWidth: 20, textAlign: "center" as const },
    deleteBtn: { padding: 6 },
    summaryBox: {
      margin: 16,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
    summaryLabel: { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    summaryValue: { fontSize: 14, color: colors.foreground, fontFamily: "Inter_500Medium" },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
    totalLabel: { fontSize: 16, color: colors.foreground, fontFamily: "Inter_700Bold" },
    totalValue: { fontSize: 18, color: colors.primary, fontFamily: "Inter_700Bold" },
    checkoutBtn: {
      backgroundColor: colors.primary,
      marginHorizontal: 16,
      marginBottom: isWeb ? 16 : insets.bottom + 16,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
    },
    checkoutBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={styles.title}>My Cart ({totalItems})</Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="shopping-cart" size={56} color={colors.mutedForeground} />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyText}>Add items from a store to get started.</Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.replace("/(tabs)/stores" as any)}>
            <Text style={styles.emptyBtnText}>Browse Stores</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {items.map((item) => (
            <View key={item.product.id} style={styles.itemCard}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.product.name}</Text>
                {item.storeName && <Text style={styles.itemStore}>{item.storeName}</Text>}
                <Text style={styles.itemPrice}>{formatPKR(item.product.price * item.quantity)}</Text>
              </View>
              <View style={styles.qtyRow}>
                <Pressable
                  style={styles.qtyBtn}
                  onPress={async () => {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    updateQuantity(item.product.id, item.quantity - 1);
                  }}
                >
                  <Feather name="minus" size={14} color={colors.foreground} />
                </Pressable>
                <Text style={styles.qtyText}>{item.quantity}</Text>
                <Pressable
                  style={[styles.qtyBtn, item.quantity >= item.product.stock && styles.qtyBtnDisabled]}
                  onPress={async () => {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    updateQuantity(item.product.id, item.quantity + 1);
                  }}
                  // As in the website's cart: no more than the shop has.
                  disabled={item.quantity >= item.product.stock}
                >
                  <Feather name="plus" size={14} color={colors.foreground} />
                </Pressable>
              </View>
              <Pressable
                style={styles.deleteBtn}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  removeItem(item.product.id);
                }}
              >
                <Feather name="trash-2" size={18} color={colors.destructive} />
              </Pressable>
            </View>
          ))}

          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal ({totalItems} items)</Text>
              <Text style={styles.summaryValue}>{formatPKR(totalPrice)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery fee</Text>
              <Text style={styles.summaryValue}>{deliveryFee === 0 ? "Free" : formatPKR(deliveryFee)}</Text>
            </View>
            {deliveryFee > 0 && (
              <Text style={styles.summaryLabel}>
                Add PKR {Math.ceil(FREE_DELIVERY_THRESHOLD - totalPrice)} more for free delivery.
              </Text>
            )}
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatPKR(grandTotal)}</Text>
            </View>
          </View>
        </ScrollView>
      )}

      {items.length > 0 && (
        <Pressable
          style={styles.checkoutBtn}
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/checkout" as any);
          }}
        >
          <Text style={styles.checkoutBtnText}>Proceed to Checkout — {formatPKR(grandTotal)}</Text>
        </Pressable>
      )}
    </View>
  );
}
