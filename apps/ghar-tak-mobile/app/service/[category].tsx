import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoadError, LoadingBlock } from "@/components/LoadState";
import { NearbyScopeLine, NoneNearby } from "@/components/NearbyScope";
import { useColors } from "@/hooks/useColors";
import { useNearbyFilter, useShowAll } from "@/hooks/useNearby";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import { useData } from "@/context/DataContext";
import { ApiError } from "@/lib/api";
import {
  categoryLabel,
  deliveryRadiusLabel,
  distanceLabel,
  distanceTo,
  nearestFirst,
  openStatusLabel,
  type ProviderType,
  type ServiceProvider,
  type Store,
} from "@/lib/data";
import { fetchProviderList } from "@/lib/db";

interface Row {
  id: string;
  type: ProviderType;
  name: string;
  description: string;
  rating: number;
  address: string;
  detail: string;
  isOpen: boolean;
  distanceKm: number | null;
}

export default function ServiceCategoryScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const { serviceCategories } = useData();
  const title = category ? categoryLabel(category, serviceCategories) : "";

  // Like the website's category page: every kind of provider in the category (Groceries
  // is made up of stores), and the server matches its aliases ("Grocery", "Fashion", ...).
  // With a precise location the server sends only those that reach it, nearest first.
  const { showAll, setShowAll } = useShowAll();
  const { point, filterPoint: nearPoint, approximate } = useNearbyFilter();
  const filterPoint = showAll ? null : nearPoint;
  const query = useQuery({
    queryKey: ["providers", "category", category, filterPoint?.lat, filterPoint?.lng],
    queryFn: ({ signal }) => fetchProviderList({ category, near: filterPoint }, signal),
    enabled: !!category,
  });

  const rows = useMemo<Row[]>(() => {
    if (!query.data) return [];
    // Both kinds in one list, nearest first when the customer's location is known.
    const providers: (ServiceProvider | Store)[] = [...query.data.serviceProviders, ...query.data.stores];
    return nearestFirst(providers, point).map((p) => ({
      id: p.id,
      type: p.type,
      name: p.name,
      description: p.description,
      rating: p.rating,
      address: p.location.address,
      detail: "serviceCategory" in p ? openStatusLabel(p) : deliveryRadiusLabel(p.deliveryRadiusKm),
      isOpen: p.isOpen,
      distanceKm: distanceTo(point, p),
    }));
  }, [query.data, point]);
  const nameLower = (title || "providers").toLowerCase();

  const styles = useThemedStyles(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: isWeb ? 67 : insets.top + 12,
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 14,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontSize: 20,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
    },
    scope: { paddingHorizontal: 16, paddingTop: 12 },
    list: { padding: 16 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "#f3e8ff",
      alignItems: "center",
      justifyContent: "center",
    },
    info: { flex: 1 },
    name: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
    },
    desc: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 3,
      lineHeight: 18,
    },
    meta: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 8 },
    metaText: { fontSize: 12, color: colors.foreground, fontFamily: "Inter_500Medium" },
    metaMuted: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", flexShrink: 1 },
    detail: {
      fontSize: 12,
      color: "#16a34a",
      fontFamily: "Inter_500Medium",
      marginTop: 4,
    },
    detailClosed: { color: colors.destructive },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
    emptyText: { fontSize: 16, color: colors.mutedForeground, fontFamily: "Inter_500Medium", marginTop: 12 },
    footer: { height: isWeb ? 34 : insets.bottom + 20 },
  }));

  const renderBody = () => {
    if (query.isPending && query.fetchStatus !== "idle") {
      return <LoadingBlock label={filterPoint ? `Finding ${nameLower} near you…` : "Loading providers…"} />;
    }
    if (query.isError) {
      return (
        <LoadError
          title="Couldn't load this category"
          message={query.error instanceof ApiError ? query.error.message : null}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      );
    }
    if (rows.length === 0) {
      if (filterPoint) {
        return (
          <NoneNearby
            message={`No ${nameLower} reach your location yet.`}
            allLabel={`See all ${nameLower}`}
            onAll={() => setShowAll(true)}
          />
        );
      }
      return (
        <View style={styles.empty}>
          <Feather name="users" size={40} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>No providers in this category</Text>
        </View>
      );
    }
    return (
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListFooterComponent={<View style={styles.footer} />}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              item.type === "service"
                ? router.push({ pathname: "/provider/[id]", params: { id: item.id } })
                : router.push({ pathname: "/store/[id]", params: { id: item.id } })
            }
          >
            <View style={styles.avatar}>
              <Feather
                name={item.type === "service" ? "user" : "shopping-bag"}
                size={26}
                color={colors.primary}
              />
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
              ) : null}
              <View style={styles.meta}>
                {item.rating > 0 && (
                  <>
                    <Feather name="star" size={12} color="#f59e0b" />
                    <Text style={styles.metaText}>{item.rating.toFixed(1)}</Text>
                  </>
                )}
                {item.address ? (
                  <>
                    <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                    <Text style={styles.metaMuted} numberOfLines={1}>{item.address}</Text>
                  </>
                ) : null}
              </View>
              <Text style={[styles.detail, !item.isOpen && item.type === "service" && styles.detailClosed]}>
                {item.detail}
              </Text>
              {item.distanceKm !== null ? (
                <View style={styles.meta}>
                  <Feather name="navigation" size={12} color={colors.mutedForeground} />
                  <Text style={styles.metaMuted}>{distanceLabel(item.distanceKm, approximate)}</Text>
                </View>
              ) : null}
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={styles.title}>{title || "Service Providers"}</Text>
      </View>
      {point ? (
        <View style={styles.scope}>
          <NearbyScopeLine showAll={showAll} approximate={approximate} onShowAll={setShowAll} />
        </View>
      ) : null}
      {renderBody()}
    </View>
  );
}
