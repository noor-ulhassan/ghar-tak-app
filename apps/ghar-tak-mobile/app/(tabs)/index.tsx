import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CatalogNotice } from "@/components/LoadState";
import { LocationBanner } from "@/components/LocationBanner";
import { NearbyScopeLine, NearRequestState, NoneNearby } from "@/components/NearbyScope";
import { useColors } from "@/hooks/useColors";
import { useNearbyCatalog, useShowAll } from "@/hooks/useNearby";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import { useData } from "@/context/DataContext";
import { deliveryRadiusLabel, distanceLabel, distanceTo } from "@/lib/data";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top;
  const { serviceCategories } = useData();
  const { showAll, setShowAll } = useShowAll();
  const { point, filterPoint, approximate, stores, near, refreshing, refresh } = useNearbyCatalog(showAll);
  const firstStores = stores.slice(0, 4);

  const handleSearch = () => {
    if (query.trim()) {
      router.push({ pathname: "/search", params: { q: query.trim() } });
    }
  };

  const styles = useThemedStyles(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    hero: {
      paddingTop: topPad + 24,
      paddingBottom: 28,
      paddingHorizontal: 20,
      backgroundColor: "rgba(124,58,237,0.07)",
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
      alignItems: "center",
    },
    heroTitle: {
      fontSize: 28,
      fontWeight: "800" as const,
      color: colors.primary,
      fontFamily: "Inter_700Bold",
      textAlign: "center" as const,
      marginBottom: 6,
    },
    heroSubtitle: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center" as const,
      lineHeight: 20,
      marginBottom: 18,
      maxWidth: 280,
    },
    searchRow: {
      flexDirection: "row",
      width: "100%" as const,
      gap: 8,
      alignItems: "center",
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
    searchBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 11,
      gap: 6,
    },
    searchBtnText: {
      fontSize: 14,
      color: "#fff",
      fontFamily: "Inter_600SemiBold",
    },
    poweredBy: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 8,
    },

    locationSection: { paddingHorizontal: 16, marginTop: 16 },
    section: { paddingHorizontal: 16, marginTop: 24 },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
    },
    seeAll: {
      fontSize: 13,
      color: colors.primary,
      fontFamily: "Inter_500Medium",
    },

    storeCard: {
      width: 190,
      backgroundColor: colors.card,
      borderRadius: 14,
      marginRight: 12,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
    },
    storeImage: { width: "100%" as const, height: 110 },
    storeInfo: { padding: 11 },
    storeName: {
      fontSize: 13,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
    },
    storeCatBadge: {
      alignSelf: "flex-start" as const,
      backgroundColor: colors.secondary,
      borderRadius: 6,
      paddingHorizontal: 7,
      paddingVertical: 2,
      marginTop: 4,
    },
    storeCatText: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    storeMeta: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
      gap: 6,
    },
    storeMetaText: {
      fontSize: 12,
      color: colors.foreground,
      fontFamily: "Inter_500Medium",
    },
    storeMetaMuted: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    viewStoreBtn: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 6,
      alignItems: "center",
    },
    viewStoreBtnText: {
      fontSize: 12,
      color: colors.foreground,
      fontFamily: "Inter_500Medium",
    },

    catGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    catChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.secondary,
      borderRadius: 24,
      paddingHorizontal: 13,
      paddingVertical: 8,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    catName: {
      fontSize: 13,
      color: colors.foreground,
      fontFamily: "Inter_500Medium",
    },

    aiRow: {
      flexDirection: "row",
      gap: 10,
    },
    aiCard: {
      flex: 1,
      borderRadius: 14,
      padding: 14,
      alignItems: "center",
      gap: 8,
      borderWidth: 1,
    },
    aiLabel: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      textAlign: "center" as const,
    },

    ctaSection: {
      marginHorizontal: 16,
      marginTop: 24,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      alignItems: "center",
    },
    ctaTitle: {
      fontSize: 20,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
      textAlign: "center" as const,
    },
    ctaSub: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center" as const,
      marginTop: 6,
      marginBottom: 16,
    },
    ctaRow: { flexDirection: "row", gap: 10 },
    ctaBtn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 20,
      alignItems: "center",
    },
    ctaBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
    ctaOutlineBtn: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 20,
      alignItems: "center",
    },
    ctaOutlineBtnText: { color: colors.foreground, fontSize: 14, fontFamily: "Inter_600SemiBold" },

    bottomPad: { height: isWeb ? 34 : insets.bottom + 80 },
  }));

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Hero — matches web's gradient hero section */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Welcome to Ghar Tak</Text>
          <Text style={styles.heroSubtitle}>
            Your One-Stop Local Hub. Discover and order products & services from your neighborhood.
          </Text>
          <View style={styles.searchRow}>
            <View style={styles.searchBarWrap}>
              <Feather name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                style={styles.searchInput}
                placeholder="What are you looking for today?"
                placeholderTextColor={colors.mutedForeground}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              <Pressable onPress={() => router.push("/image-analyzer")}>
                <Feather name="camera" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <Pressable style={styles.searchBtn} onPress={handleSearch}>
              <Feather name="search" size={14} color="#fff" />
              <Text style={styles.searchBtnText}>Search</Text>
            </Pressable>
          </View>
          <Text style={styles.poweredBy}>Powered by AI for smarter results.</Text>
        </View>

        <View style={styles.locationSection}>
          <LocationBanner />
        </View>

        {/* Stores: those that deliver to the customer once their location is known precisely */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{filterPoint ? "Stores near you" : "Stores"}</Text>
            <Pressable
              onPress={() => router.push("/(tabs)/stores")}
              accessibilityRole="button"
              accessibilityLabel="See all stores"
            >
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          {point ? <NearbyScopeLine showAll={showAll} approximate={approximate} onShowAll={setShowAll} /> : null}
          {filterPoint || near.loading ? <NearRequestState near={near} what="stores" /> : <CatalogNotice />}
          {filterPoint && !near.loading && !near.error && firstStores.length === 0 ? (
            <NoneNearby
              message="No stores deliver to your location yet."
              allLabel="Browse all stores"
              onAll={() => router.push({ pathname: "/(tabs)/stores", params: { view: "all" } })}
            />
          ) : null}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {firstStores.map((item) => {
              const km = distanceTo(point, item);
              return (
                <Pressable
                  key={item.id}
                  style={styles.storeCard}
                  onPress={() => router.push({ pathname: "/store/[id]", params: { id: item.id } })}
                >
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.storeImage}
                    contentFit="cover"
                    transition={150}
                    cachePolicy="memory-disk"
                    recyclingKey={item.id}
                  />
                  <View style={styles.storeInfo}>
                    <Text style={styles.storeName} numberOfLines={1}>{item.name}</Text>
                    <View style={styles.storeCatBadge}>
                      <Text style={styles.storeCatText}>{item.category}</Text>
                    </View>
                    <View style={styles.storeMeta}>
                      {item.rating > 0 && (
                        <>
                          <Feather name="star" size={11} color="#f59e0b" />
                          <Text style={styles.storeMetaText}>{item.rating.toFixed(1)}</Text>
                        </>
                      )}
                      <Feather name="truck" size={11} color={colors.mutedForeground} />
                      <Text style={styles.storeMetaMuted} numberOfLines={1}>
                        {deliveryRadiusLabel(item.deliveryRadiusKm)}
                      </Text>
                    </View>
                    {km !== null ? (
                      <View style={styles.storeMeta}>
                        <Feather name="navigation" size={11} color={colors.mutedForeground} />
                        <Text style={styles.storeMetaMuted} numberOfLines={1}>{distanceLabel(km, approximate)}</Text>
                      </View>
                    ) : null}
                    <View style={styles.viewStoreBtn}>
                      <Text style={styles.viewStoreBtnText}>View Store</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Services */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Services</Text>
            <Pressable onPress={() => router.push("/(tabs)/services")}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          <View style={styles.catGrid}>
            {serviceCategories.slice(0, 8).map((cat) => (
              <Pressable
                key={cat.id}
                style={styles.catChip}
                onPress={() =>
                  router.push({ pathname: "/service/[category]", params: { category: cat.id } })
                }
              >
                <Feather name={cat.icon} size={13} color={colors.primary} />
                <Text style={styles.catName}>{cat.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* AI Tools */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { marginBottom: 14 }]}>AI Tools</Text>
          <View style={styles.aiRow}>
            <Pressable
              style={[styles.aiCard, { backgroundColor: "#f5f0ff", borderColor: "#e9d5ff" }]}
              onPress={() => router.push("/image-analyzer")}
            >
              <Feather name="camera" size={22} color="#7c3aed" />
              <Text style={[styles.aiLabel, { color: "#7c3aed" }]}>Image{"\n"}Search</Text>
            </Pressable>
            <Pressable
              style={[styles.aiCard, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}
              onPress={() => router.push("/chatbot")}
            >
              <Feather name="message-circle" size={22} color="#2563eb" />
              <Text style={[styles.aiLabel, { color: "#2563eb" }]}>AI{"\n"}Assistant</Text>
            </Pressable>
            <Pressable
              style={[styles.aiCard, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}
              onPress={() => router.push({ pathname: "/search", params: { q: "recommendations" } })}
            >
              <Feather name="zap" size={22} color="#16a34a" />
              <Text style={[styles.aiLabel, { color: "#16a34a" }]}>For{"\n"}You</Text>
            </Pressable>
          </View>
        </View>

        {/* Ready to Explore CTA — mirrors web */}
        <View style={styles.ctaSection}>
          <Text style={styles.ctaTitle}>Ready to Explore?</Text>
          <Text style={styles.ctaSub}>
            Sign up or log in to save your favorites and manage your orders.
          </Text>
          <View style={styles.ctaRow}>
            <Pressable style={styles.ctaBtn} onPress={() => router.push("/signup")}>
              <Text style={styles.ctaBtnText}>Get Started</Text>
            </Pressable>
            <Pressable style={styles.ctaOutlineBtn} onPress={() => router.push("/signin")}>
              <Text style={styles.ctaOutlineBtnText}>Sign In</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </View>
  );
}
