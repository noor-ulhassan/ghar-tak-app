import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import { useData } from "@/context/DataContext";

export default function FavoritesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { stores } = useData();
  const favorites = stores.filter((s) => s.isFavorite);

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
    title: { fontSize: 20, fontWeight: "700" as const, color: colors.foreground, fontFamily: "Inter_700Bold" },
    content: { padding: 20 },
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: "#fef2f2",
      alignItems: "center",
      justifyContent: "center",
    },
    info: { flex: 1 },
    name: { fontSize: 15, fontWeight: "600" as const, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    meta: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    empty: { alignItems: "center", paddingTop: 60 },
    emptyText: { fontSize: 16, color: colors.mutedForeground, fontFamily: "Inter_500Medium", marginTop: 12 },
    emptySubtext: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 6, textAlign: "center" as const },
    footer: { height: isWeb ? 34 : insets.bottom + 20 },
  }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={styles.title}>Favorites</Text>
      </View>
      {/* Only the favorites near the screen are mounted, however many a customer saves. */}
      <FlatList
        contentContainerStyle={styles.content}
        data={favorites}
        keyExtractor={(store) => store.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="heart" size={40} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No favorites yet</Text>
            <Text style={styles.emptySubtext}>Tap the heart icon on any store to save it here</Text>
          </View>
        }
        renderItem={({ item: store }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push({ pathname: "/store/[id]", params: { id: store.id } })}
          >
            <View style={styles.iconWrap}>
              <Feather name="heart" size={22} color="#ef4444" />
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{store.name}</Text>
              <Text style={styles.meta}>{store.category} • {store.rating} ★ • {store.deliveryTime}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
        ListFooterComponent={<View style={styles.footer} />}
      />
    </View>
  );
}
