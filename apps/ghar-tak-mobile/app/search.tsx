import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import { useData } from "@/context/DataContext";
import { CatalogNotice } from "@/components/LoadState";
import { useNearbyFilter } from "@/hooks/useNearby";
import { categoryLabel, deliveryRadiusLabel, distanceLabel, distanceTo } from "@/lib/data";

interface Result {
  id: string;
  type: "store" | "provider";
  name: string;
  subtitle: string;
  icon: string;
}

export default function SearchScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const [query, setQuery] = useState(q ?? "");
  const { stores, serviceProviders, serviceCategories, ready } = useData();
  // Search covers every shop, near or far; the distance just helps.
  const { point, approximate } = useNearbyFilter();

  const results = useMemo<Result[]>(() => {
    const term = query.toLowerCase().trim();
    if (!term) return [];
    const away = (p: (typeof stores)[number] | (typeof serviceProviders)[number]) => {
      const km = distanceTo(point, p);
      return km === null ? null : distanceLabel(km, approximate);
    };

    const storeResults: Result[] = stores
      .filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          s.category.toLowerCase().includes(term) ||
          s.description.toLowerCase().includes(term)
      )
      .map((s) => ({
        id: s.id,
        type: "store" as const,
        name: s.name,
        subtitle: [s.category, deliveryRadiusLabel(s.deliveryRadiusKm), away(s)].filter(Boolean).join(" • "),
        icon: "shopping-bag",
      }));

    const providerResults: Result[] = serviceProviders
      .filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.serviceCategory.toLowerCase().includes(term) ||
          p.description.toLowerCase().includes(term)
      )
      .map((p) => ({
        id: p.id,
        type: "provider" as const,
        name: p.name,
        subtitle: [categoryLabel(p.serviceCategory, serviceCategories), p.location.address, away(p)]
          .filter(Boolean)
          .join(" • "),
        icon: "user",
      }));

    return [...storeResults, ...providerResults];
  }, [query, stores, serviceProviders, serviceCategories, point, approximate]);

  const handlePress = (item: Result) => {
    if (item.type === "store") {
      router.push({ pathname: "/store/[id]", params: { id: item.id } });
    } else {
      router.push({ pathname: "/provider/[id]", params: { id: item.id } });
    }
  };

  const styles = useThemedStyles(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: isWeb ? 67 : insets.top + 12,
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
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
    searchBar: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.secondary,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 10,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
    },
    list: { paddingHorizontal: 16, paddingTop: 8 },
    item: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 14,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
    },
    info: { flex: 1 },
    name: { fontSize: 15, color: colors.foreground, fontFamily: "Inter_500Medium" },
    subtitle: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    typeBadge: {
      backgroundColor: colors.secondary,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    typeText: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    empty: { flex: 1, alignItems: "center", paddingTop: 60 },
    emptyTitle: { fontSize: 16, color: colors.mutedForeground, fontFamily: "Inter_500Medium", marginTop: 16 },
    emptySubtitle: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 6, textAlign: "center" as const },
    footer: { height: isWeb ? 34 : insets.bottom + 20 },
  }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={styles.input}
            placeholder="Search stores and services..."
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.list}>
        <CatalogNotice />
      </View>

      {!ready ? null : query && results.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="search" size={40} color={colors.mutedForeground} />
          <Text style={styles.emptyTitle}>No results found</Text>
          <Text style={styles.emptySubtitle}>Try a different search term</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          scrollEnabled={!!results.length}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          ListFooterComponent={<View style={styles.footer} />}
          renderItem={({ item }) => (
            <Pressable style={styles.item} onPress={() => handlePress(item)}>
              <View style={styles.iconWrap}>
                <Feather name={item.icon as any} size={20} color={colors.primary} />
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.subtitle}>{item.subtitle}</Text>
              </View>
              <View style={styles.typeBadge}>
                <Text style={styles.typeText}>{item.type}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
