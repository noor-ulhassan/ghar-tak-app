import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCart } from "@/context/CartContext";
import { useColors } from "@/hooks/useColors";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import { deliveryFeeFor, formatPKR, FREE_DELIVERY_THRESHOLD } from "@/lib/pricing";

export default function CheckoutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { items, loaded, totalPrice, placeOrder } = useCart();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  // Placing an order empties the cart on purpose, so it must not trigger the redirect below.
  const placingOrder = useRef(false);

  // Nothing to check out: go back to the cart, but only once the saved cart has loaded.
  useEffect(() => {
    if (loaded && items.length === 0 && !placingOrder.current) {
      router.replace("/cart" as any);
    }
  }, [loaded, items.length]);

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
    scroll: { flex: 1 },
    section: {
      margin: 16,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
      marginBottom: 14,
    },
    label: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_500Medium",
      marginBottom: 6,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
    },
    input: {
      backgroundColor: colors.secondary,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    orderItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    orderItemName: { flex: 1, fontSize: 14, color: colors.foreground, fontFamily: "Inter_400Regular" },
    orderItemQty: { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginHorizontal: 8 },
    orderItemPrice: { fontSize: 14, color: colors.foreground, fontFamily: "Inter_500Medium" },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
    totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
    totalLabel: { fontSize: 15, fontFamily: "Inter_700Bold", color: colors.foreground },
    totalValue: { fontSize: 17, fontFamily: "Inter_700Bold", color: colors.primary },
    placeBtn: {
      backgroundColor: colors.primary,
      marginHorizontal: 16,
      marginBottom: isWeb ? 16 : insets.bottom + 16,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
    },
    placeBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
    placeBtnDisabled: { opacity: 0.5 },
    paymentRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    paymentIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    paymentLabel: { fontSize: 14, color: colors.foreground, fontFamily: "Inter_400Regular" },
    paymentMuted: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 1 },
  }));

  const handlePlaceOrder = async () => {
    if (!name.trim()) { Alert.alert("Missing info", "Please enter your name."); return; }
    if (!address.trim()) { Alert.alert("Missing info", "Please enter a delivery address."); return; }
    if (!phone.trim()) { Alert.alert("Missing info", "Please enter your phone number."); return; }

    setLoading(true);
    placingOrder.current = true;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const order = await placeOrder(name.trim(), address.trim(), phone.trim());
      router.replace({ pathname: "/order-success", params: { orderId: order.id } } as any);
    } catch {
      placingOrder.current = false;
      Alert.alert("Error", "Could not place your order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const deliveryFee = deliveryFeeFor(totalPrice);
  const grandTotal = totalPrice + deliveryFee;

  // Every hook above runs on every render; only now is it safe to show nothing.
  if (items.length === 0) return null;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={styles.title}>Checkout</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Details</Text>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          <Text style={styles.label}>Delivery Address</Text>
          <TextInput
            style={[styles.input, { minHeight: 70, textAlignVertical: "top" }]}
            placeholder="Street address, area, city"
            placeholderTextColor={colors.mutedForeground}
            value={address}
            onChangeText={setAddress}
            multiline
            autoCapitalize="sentences"
          />
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="+92 300 0000000"
            placeholderTextColor={colors.mutedForeground}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <View style={styles.paymentRow}>
            <View style={styles.paymentIcon}>
              <Feather name="dollar-sign" size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.paymentLabel}>Cash on Delivery</Text>
              <Text style={styles.paymentMuted}>Pay when your order arrives</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          {items.map((item) => (
            <View key={item.product.id} style={styles.orderItem}>
              <Text style={styles.orderItemName} numberOfLines={1}>{item.product.name}</Text>
              <Text style={styles.orderItemQty}>×{item.quantity}</Text>
              <Text style={styles.orderItemPrice}>{formatPKR(item.product.price * item.quantity)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.orderItem}>
            <Text style={styles.orderItemName}>Delivery fee</Text>
            <Text style={styles.orderItemPrice}>{deliveryFee === 0 ? "Free" : formatPKR(deliveryFee)}</Text>
          </View>
          {deliveryFee > 0 && (
            <Text style={styles.orderItemQty}>
              Add PKR {(FREE_DELIVERY_THRESHOLD - totalPrice).toFixed(0)} more for free delivery.
            </Text>
          )}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatPKR(grandTotal)}</Text>
          </View>
        </View>

        <View style={{ height: 8 }} />
      </ScrollView>

      <Pressable
        style={[styles.placeBtn, loading && styles.placeBtnDisabled]}
        onPress={handlePlaceOrder}
        disabled={loading}
      >
        <Text style={styles.placeBtnText}>
          {loading ? "Placing Order…" : `Place Order — ${formatPKR(grandTotal)}`}
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}
