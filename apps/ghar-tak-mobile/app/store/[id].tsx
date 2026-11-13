import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DeliveryReach } from "@/components/DeliveryReach";
import { LoadError, LoadingBlock } from "@/components/LoadState";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useColors } from "@/hooks/useColors";
import { useFavorites } from "@/hooks/useFavorites";
import { retryUnlessNotFound, useStore } from "@/hooks/useProvider";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import { ApiError } from "@/lib/api";
import { deliveryRadiusLabel, openStatusLabel, type Product } from "@/lib/data";
import { fetchProducts } from "@/lib/db";
import { formatPKR } from "@/lib/pricing";

export default function StoreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { user } = useAuth();
  const { favouriteIds, toggleFavourite } = useFavorites();
  const favorited = !!id && favouriteIds.has(id);
  const { addItem, updateQuantity, items, totalItems } = useCart();

  const storeState = useStore(id);
  const { store } = storeState;
  const productsQuery = useQuery({
    queryKey: ["provider", id, "products"],
    queryFn: ({ signal }) => fetchProducts(id as string, signal),
    enabled: !!id && !!store && store.type !== "service",
    retry: retryUnlessNotFound,
  });
  const products = productsQuery.data ?? [];

  // A service provider's link opened as a store: show its own page instead.
  useEffect(() => {
    if (store?.type === "service") {
      router.replace({ pathname: "/provider/[id]", params: { id: store.id } });
    }
  }, [store?.type, store?.id]);

  const quantities = useMemo(
    () => new Map(items.map((item) => [item.product.id, item.quantity])),
    [items],
  );
  const getItemQty = (productId: string) => quantities.get(productId) ?? 0;

  const styles = useThemedStyles(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    imageWrap: { position: "relative" as const },
    heroImage: { width: "100%" as const, height: 240 },
    backBtn: {
      position: "absolute" as const,
      top: isWeb ? 67 : insets.top + 8,
      left: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(0,0,0,0.4)",
      alignItems: "center",
      justifyContent: "center",
    },
    favBtn: {
      position: "absolute" as const,
      top: isWeb ? 67 : insets.top + 8,
      right: 64,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(0,0,0,0.4)",
      alignItems: "center",
      justifyContent: "center",
    },
    cartBtn: {
      position: "absolute" as const,
      top: isWeb ? 67 : insets.top + 8,
      right: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(0,0,0,0.4)",
      alignItems: "center",
      justifyContent: "center",
    },
    cartBadge: {
      position: "absolute" as const,
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 3,
    },
    cartBadgeText: { fontSize: 10, color: "#fff", fontFamily: "Inter_700Bold" },
    // Header and footer keep the old 20px side padding; product cards get it as a margin.
    header: { paddingHorizontal: 20, paddingTop: 20 },
    listEdge: { paddingHorizontal: 20 },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    name: {
      fontSize: 22,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
      flex: 1,
    },
    badge: {
      backgroundColor: colors.secondary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      marginLeft: 8,
    },
    badgeText: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    desc: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      lineHeight: 20,
      marginTop: 8,
    },
    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap" as const,
      columnGap: 20,
      rowGap: 10,
      marginTop: 14,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    metaText: { fontSize: 13, color: colors.foreground, fontFamily: "Inter_500Medium" },
    metaMuted: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
      marginTop: 20,
      marginBottom: 12,
    },
    productCard: {
      marginHorizontal: 20,
      flexDirection: "row",
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    productInfo: { flex: 1 },
    productName: { fontSize: 14, color: colors.foreground, fontFamily: "Inter_500Medium" },
    productCategory: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    productPrice: { fontSize: 16, fontWeight: "700" as const, color: colors.primary, fontFamily: "Inter_700Bold", marginTop: 4 },
    addBtn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    addBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
    qtyControls: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
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
    qtyBtnPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    qtyText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground, minWidth: 20, textAlign: "center" as const },
    viewCartBtn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 20,
      flexDirection: "row",
      justifyContent: "center",
      gap: 8,
    },
    viewCartBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
    empty: { alignItems: "center", paddingVertical: 24 },
    emptyText: { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 8 },
    footer: { height: isWeb ? 34 : insets.bottom + 20 },
    centered: { flex: 1, justifyContent: "center", backgroundColor: colors.background },
    openText: { fontSize: 13, color: "#16a34a", fontFamily: "Inter_500Medium" },
    closedText: { fontSize: 13, color: colors.destructive, fontFamily: "Inter_500Medium" },
  }));

  if (!store && storeState.loading) {
    return (
      <View style={styles.centered}>
        <LoadingBlock label="Loading store…" />
      </View>
    );
  }

  if (!store && storeState.error) {
    return (
      <View style={styles.centered}>
        <LoadError
          title="Couldn't load this store"
          message={storeState.error instanceof ApiError ? storeState.error.message : null}
          onRetry={storeState.retry}
          retrying={storeState.retrying}
        />
        <Pressable onPress={() => router.back()} style={{ alignSelf: "center" }}>
          <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (!store) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
        <Text style={{ color: colors.mutedForeground, marginTop: 12, fontFamily: "Inter_400Regular" }}>
          Store not found
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const renderProductCard = (p: Product) => {
    const qty = getItemQty(p.id);
    return (
      <View key={p.id} style={styles.productCard}>
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{p.name}</Text>
          <Text style={styles.productCategory}>{p.category}</Text>
          <Text style={styles.productPrice}>{formatPKR(p.price)}</Text>
        </View>
        {qty === 0 ? (
          <Pressable
            style={styles.addBtn}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              addItem(p, store.name);
            }}
          >
            <Feather name="plus" size={14} color="#fff" />
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        ) : (
          <View style={styles.qtyControls}>
            <Pressable
              style={styles.qtyBtn}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                updateQuantity(p.id, qty - 1);
              }}
            >
              <Feather name="minus" size={13} color={colors.foreground} />
            </Pressable>
            <Text style={styles.qtyText}>{qty}</Text>
            <Pressable
              style={[styles.qtyBtn, styles.qtyBtnPrimary]}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                updateQuantity(p.id, qty + 1);
              }}
            >
              <Feather name="plus" size={13} color="#fff" />
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  // A FlatList only mounts the products near the screen, so a store with hundreds
  // of products opens about as fast as one with three.
  return (
    <FlatList
      style={styles.container}
      showsVerticalScrollIndicator={false}
      data={products}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => renderProductCard(item)}
      extraData={quantities}
      ListHeaderComponent={
        <>
          <View style={styles.imageWrap}>
            <Image
              source={{ uri: store.imageUrl }}
              style={styles.heroImage}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
            <Pressable style={styles.backBtn} onPress={() => router.back()}>
              <Feather name="arrow-left" size={20} color="#fff" />
            </Pressable>
            <Pressable
              style={styles.favBtn}
              onPress={async () => {
                if (!user) {
                  router.push("/signin");
                  return;
                }
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                await toggleFavourite(store.id);
              }}
              accessibilityLabel={favorited ? "Remove from favourites" : "Add to favourites"}
            >
              <Feather name="heart" size={20} color={favorited ? "#ef4444" : "#fff"} />
            </Pressable>
            <Pressable style={styles.cartBtn} onPress={() => router.push("/cart" as any)}>
              <Feather name="shopping-cart" size={20} color="#fff" />
              {totalItems > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{totalItems}</Text>
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.header}>
            <View style={styles.row}>
              <Text style={styles.name}>{store.name}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{store.category}</Text>
              </View>
            </View>
            <Text style={styles.desc}>{store.description}</Text>

            <View style={styles.metaRow}>
              {store.rating > 0 && (
                <View style={styles.metaItem}>
                  <Feather name="star" size={14} color="#f59e0b" />
                  <Text style={styles.metaText}>{store.rating.toFixed(1)}</Text>
                </View>
              )}
              <View style={styles.metaItem}>
                <Feather name="clock" size={14} color={store.isOpen ? "#16a34a" : colors.destructive} />
                <Text style={store.isOpen ? styles.openText : styles.closedText}>{openStatusLabel(store)}</Text>
              </View>
              <View style={styles.metaItem}>
                <Feather name="truck" size={14} color={colors.mutedForeground} />
                <Text style={styles.metaMuted}>{deliveryRadiusLabel(store.deliveryRadiusKm)}</Text>
              </View>
              {store.location.address ? (
                <View style={styles.metaItem}>
                  <Feather name="map-pin" size={14} color={colors.mutedForeground} />
                  <Text style={styles.metaMuted} numberOfLines={1}>{store.location.address}</Text>
                </View>
              ) : null}
            </View>
            <DeliveryReach provider={store} />

            <Text style={styles.sectionTitle}>Products</Text>
          </View>
        </>
      }
      ListEmptyComponent={
        productsQuery.isPending && productsQuery.fetchStatus !== "idle" ? (
          <LoadingBlock label="Loading products…" />
        ) : productsQuery.isError ? (
          <LoadError
            title="Couldn't load products"
            message={productsQuery.error instanceof ApiError ? productsQuery.error.message : null}
            onRetry={() => void productsQuery.refetch()}
            retrying={productsQuery.isFetching}
          />
        ) : (
          <View style={styles.empty}>
            <Feather name="package" size={32} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No products listed</Text>
          </View>
        )
      }
      ListFooterComponent={
        <View style={styles.listEdge}>
          {totalItems > 0 && (
            <Pressable
              style={styles.viewCartBtn}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/cart" as any);
              }}
            >
              <Feather name="shopping-cart" size={18} color="#fff" />
              <Text style={styles.viewCartBtnText}>View Cart ({totalItems})</Text>
            </Pressable>
          )}
          <View style={styles.footer} />
        </View>
      }
    />
  );
}
