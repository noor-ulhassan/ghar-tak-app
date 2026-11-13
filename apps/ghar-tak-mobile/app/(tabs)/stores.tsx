import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CatalogNotice } from "@/components/LoadState";
import { NearbyScopeLine, NearRequestState, NoneNearby } from "@/components/NearbyScope";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import { useData } from "@/context/DataContext";
import { useFavorites } from "@/hooks/useFavorites";
import { useNearbyCatalog, useShowAll } from "@/hooks/useNearby";
import { deliveryRadiusLabel, distanceLabel, distanceTo, openStatusLabel } from "@/lib/data";

export default function StoresScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const isWeb = Platform.OS === "web";
  const { ready } = useData();
  const { showAll, setShowAll } = useShowAll();
  const { point, filterPoint, approximate, stores, near, refreshing, refresh } = useNearbyCatalog(showAll);
  // The list itself, or null while the location or a near-me request is loading, or it failed.
  const listReady = !near.loading && (filterPoint ? !near.error : ready);
  const { user } = useAuth();
  const { favouriteIds, toggleFavourite } = useFavorites();

  const filtered = query.trim()
    ? stores.filter(
        (s) =>
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          s.category.toLowerCase().includes(query.toLowerCase())
      )
    : stores;

  const styles = useThemedStyles(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: isWeb ? 67 : insets.top + 16,
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 14,
    },
    titleIcon: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: "#f5f0ff",
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontSize: 22,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    searchBarWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
    },
    cameraBtn: {
      width: 38,
      height: 38,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    searchBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 6,
    },
    searchBtnText: {
      fontSize: 14,
      color: "#fff",
      fontFamily: "Inter_600SemiBold",
    },
    list: { paddingHorizontal: 16, paddingTop: 16 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      marginBottom: 16,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
    },
    image: { width: "100%" as const, height: 160 },
    info: { padding: 14 },
    nameRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 8,
    },
    name: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
      flex: 1,
    },
    heartBtn: { padding: 2 },
    badge: {
      alignSelf: "flex-start" as const,
      backgroundColor: colors.secondary,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      marginTop: 6,
    },
    badgeText: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    desc: {
      fontSize: 13,
      color: colors.mutedForeground,
      marginTop: 6,
      fontFamily: "Inter_400Regular",
      lineHeight: 18,
    },
    meta: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 10, flexWrap: "wrap" as const },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaText: { fontSize: 13, color: colors.foreground, fontFamily: "Inter_500Medium" },
    metaMuted: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    viewBtn: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
    },
    viewBtnText: {
      fontSize: 14,
      color: colors.foreground,
      fontFamily: "Inter_500Medium",
    },
    empty: { alignItems: "center", paddingTop: 60 },
    emptyText: { fontSize: 16, color: colors.mutedForeground, fontFamily: "Inter_500Medium", marginTop: 12 },
    footer: { height: isWeb ? 34 : insets.bottom + 80 },
  }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.titleIcon}>
            <Feather name="shopping-bag" size={18} color={colors.primary} />
          </View>
          <Text style={styles.title}>{filterPoint ? "Stores near you" : "All Stores"}</Text>
        </View>
        {point ? <NearbyScopeLine showAll={showAll} approximate={approximate} onShowAll={setShowAll} /> : null}
        <View style={styles.searchRow}>
          <View style={styles.searchBarWrap}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search stores..."
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={setQuery}
            />
            {query ? (
              <Pressable onPress={() => setQuery("")}>
                <Feather name="x" size={15} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>
          <Pressable style={styles.cameraBtn} onPress={() => router.push("/image-analyzer")}>
            <Feather name="camera" size={17} color={colors.mutedForeground} />
          </Pressable>
          <Pressable
            style={styles.searchBtn}
            onPress={() => {
              if (query.trim()) {
                router.push({ pathname: "/search", params: { q: query.trim() } });
              }
            }}
          >
            <Feather name="search" size={14} color="#fff" />
            <Text style={styles.searchBtnText}>Search</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={Platform.OS === "android"}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        extraData={favouriteIds}
        ListHeaderComponent={
          filterPoint || near.loading ? <NearRequestState near={near} what="stores" /> : <CatalogNotice />
        }
        ListEmptyComponent={
          !listReady ? undefined : filterPoint && !query.trim() ? (
            <NoneNearby
              message="No stores deliver to your location yet."
              allLabel="Browse all stores"
              onAll={() => setShowAll(true)}
            />
          ) : (
            <View style={styles.empty}>
              <Feather name="shopping-bag" size={40} color={colors.mutedForeground} />
              <Text style={styles.emptyText}>No stores found</Text>
            </View>
          )
        }
        ListFooterComponent={<View style={styles.footer} />}
        renderItem={({ item }) => {
          const isFav = favouriteIds.has(item.id);
          const km = distanceTo(point, item);
          return (
            <Pressable
              style={styles.card}
              onPress={() => router.push({ pathname: "/store/[id]", params: { id: item.id } })}
            >
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.image}
                contentFit="cover"
                transition={150}
                cachePolicy="memory-disk"
                recyclingKey={item.id}
              />
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  <Pressable
                    style={styles.heartBtn}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      if (!user) {
                        router.push("/signin");
                        return;
                      }
                      toggleFavourite(item.id);
                    }}
                    accessibilityLabel={isFav ? "Remove from favourites" : "Add to favourites"}
                  >
                    <Feather
                      name="heart"
                      size={18}
                      color={isFav ? "#ef4444" : colors.mutedForeground}
                    />
                  </Pressable>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.category}</Text>
                </View>
                <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
                <View style={styles.meta}>
                  {item.location.address ? (
                    <View style={styles.metaItem}>
                      <Feather name="map-pin" size={13} color={colors.mutedForeground} />
                      <Text style={styles.metaMuted} numberOfLines={1}>{item.location.address}</Text>
                    </View>
                  ) : null}
                  {item.rating > 0 && (
                    <View style={styles.metaItem}>
                      <Feather name="star" size={13} color="#f59e0b" />
                      <Text style={styles.metaText}>{item.rating.toFixed(1)}</Text>
                    </View>
                  )}
                  {km !== null ? (
                    <View style={styles.metaItem}>
                      <Feather name="navigation" size={13} color={colors.mutedForeground} />
                      <Text style={styles.metaMuted}>{distanceLabel(km, approximate)}</Text>
                    </View>
                  ) : null}
                  <View style={styles.metaItem}>
                    <Feather name="truck" size={13} color={colors.mutedForeground} />
                    <Text style={styles.metaMuted}>{deliveryRadiusLabel(item.deliveryRadiusKm)}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Feather name="clock" size={13} color={item.isOpen ? "#16a34a" : colors.destructive} />
                    <Text style={styles.metaMuted} numberOfLines={1}>{openStatusLabel(item)}</Text>
                  </View>
                </View>
                <Pressable
                  style={styles.viewBtn}
                  onPress={() => router.push({ pathname: "/store/[id]", params: { id: item.id } })}
                >
                  <Text style={styles.viewBtnText}>View Store</Text>
                </Pressable>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
