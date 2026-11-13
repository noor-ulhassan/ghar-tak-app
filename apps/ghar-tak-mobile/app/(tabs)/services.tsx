import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CatalogNotice } from "@/components/LoadState";
import { NearbyScopeLine, NearRequestState, NoneNearby } from "@/components/NearbyScope";
import { useColors } from "@/hooks/useColors";
import { useNearbyCatalog, useShowAll } from "@/hooks/useNearby";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import { useData } from "@/context/DataContext";
import { categoryLabel, distanceLabel, distanceTo, openStatusLabel } from "@/lib/data";

export default function ServicesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { serviceCategories, ready } = useData();
  const { showAll, setShowAll } = useShowAll();
  const { point, filterPoint, approximate, serviceProviders, near, refreshing, refresh } = useNearbyCatalog(showAll);
  // The list itself, or null while a near-me request is loading or has failed.
  const listReady = filterPoint ? !near.loading && !near.error : ready;

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
    titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
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
    subtitle: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 4,
      marginLeft: 46,
    },
    // Header keeps the old 16px padding; provider cards get the same side margin.
    listHeader: { paddingHorizontal: 16, paddingTop: 16 },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
      marginBottom: 14,
      marginTop: 4,
    },

    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    catCard: {
      width: "30.5%" as const,
      aspectRatio: 1,
      backgroundColor: colors.card,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      padding: 10,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "#f5f0ff",
      alignItems: "center",
      justifyContent: "center",
    },
    catName: {
      fontSize: 11,
      color: colors.foreground,
      fontFamily: "Inter_500Medium",
      textAlign: "center" as const,
      marginTop: 8,
      lineHeight: 15,
    },

    providerSection: { marginTop: 24 },
    provCard: {
      marginHorizontal: 16,
      flexDirection: "row",
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      gap: 12,
    },
    provAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: "#f5f0ff",
      alignItems: "center",
      justifyContent: "center",
    },
    provInfo: { flex: 1 },
    provName: {
      fontSize: 15,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
    },
    provCat: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
    provMeta: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 6 },
    metaText: { fontSize: 12, color: colors.foreground, fontFamily: "Inter_500Medium" },
    metaMuted: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", flexShrink: 1 },
    emptyText: { marginHorizontal: 16, fontSize: 14 },

    footer: { height: isWeb ? 34 : insets.bottom + 80 },
  }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.titleIcon}>
            <Feather name="briefcase" size={18} color={colors.primary} />
          </View>
          <Text style={styles.title}>Services</Text>
        </View>
        <Text style={styles.subtitle}>Find local professionals</Text>
      </View>

      {/* A FlatList only mounts the providers near the screen, so a long list stays fast. */}
      <FlatList
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
        data={serviceProviders}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <CatalogNotice />
            {/* Categories grid — mirrors web's Service Categories page (GET /api/categories) */}
            {serviceCategories.length > 0 && (
              <Text style={styles.sectionTitle}>Browse by Category</Text>
            )}
            <View style={styles.grid}>
              {serviceCategories.map((cat) => (
                <Pressable
                  key={cat.id}
                  style={styles.catCard}
                  onPress={() =>
                    router.push({ pathname: "/service/[category]", params: { category: cat.id } })
                  }
                >
                  <View style={styles.iconWrap}>
                    <Feather name={cat.icon} size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.catName} numberOfLines={2}>{cat.name}</Text>
                </Pressable>
              ))}
            </View>

            {/* Service providers: like the website's Services page, those that reach the customer when it can tell */}
            {(ready || filterPoint) && (
              <View style={styles.providerSection}>
                <Text style={styles.sectionTitle}>
                  {filterPoint ? "Service Providers Near You" : "Service Providers"}
                </Text>
                {point ? <NearbyScopeLine showAll={showAll} approximate={approximate} onShowAll={setShowAll} /> : null}
              </View>
            )}
            {filterPoint ? <NearRequestState near={near} what="service providers" /> : null}
          </View>
        }
        ListEmptyComponent={
          !listReady ? undefined : filterPoint ? (
            <NoneNearby
              message="No service providers cover your location yet."
              allLabel="See all service providers"
              onAll={() => setShowAll(true)}
            />
          ) : (
            <Text style={[styles.metaMuted, styles.emptyText]}>No service providers yet.</Text>
          )
        }
        renderItem={({ item: p }) => {
          const km = distanceTo(point, p);
          return (
            <Pressable
              style={styles.provCard}
              onPress={() =>
                router.push({ pathname: "/provider/[id]", params: { id: p.id } })
              }
            >
              <View style={styles.provAvatar}>
                <Feather name="user" size={22} color={colors.primary} />
              </View>
              <View style={styles.provInfo}>
                <Text style={styles.provName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.provCat}>
                  {categoryLabel(p.serviceCategory, serviceCategories) || openStatusLabel(p)}
                </Text>
                <View style={styles.provMeta}>
                  {p.rating > 0 && (
                    <>
                      <Feather name="star" size={12} color="#f59e0b" />
                      <Text style={styles.metaText}>{p.rating.toFixed(1)}</Text>
                    </>
                  )}
                  {p.location.address ? (
                    <>
                      <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                      <Text style={styles.metaMuted} numberOfLines={1}>{p.location.address}</Text>
                    </>
                  ) : null}
                </View>
                {km !== null ? (
                  <View style={styles.provMeta}>
                    <Feather name="navigation" size={12} color={colors.mutedForeground} />
                    <Text style={styles.metaMuted}>{distanceLabel(km, approximate)}</Text>
                  </View>
                ) : null}
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>
          );
        }}
        ListFooterComponent={<View style={styles.footer} />}
      />
    </View>
  );
}
