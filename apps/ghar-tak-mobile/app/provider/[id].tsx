import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useThemedStyles } from "@/hooks/useThemedStyles";
import { useBookings } from "@/context/BookingsContext";
import { useData } from "@/context/DataContext";
import { LoadError, LoadingBlock } from "@/components/LoadState";
import { retryUnlessNotFound, useServiceProvider } from "@/hooks/useProvider";
import { categoryLabel, openStatusLabel } from "@/lib/data";
import { fetchServices } from "@/lib/db";
import { ApiError, getBaseUrl } from "@/lib/api";

const TIME_SLOTS = ["Morning (9am – 12pm)", "Afternoon (12pm – 4pm)", "Evening (4pm – 8pm)"];

function upcomingDays(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
    return { iso, label: i === 0 ? "Today" : weekday, day: d.getDate() };
  });
}

export default function ProviderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const { serviceCategories } = useData();
  const { bookService } = useBookings();
  const providerState = useServiceProvider(id);
  const { provider } = providerState;
  const catName = provider ? categoryLabel(provider.serviceCategory, serviceCategories) : null;
  // The services this provider lists (GET /api/providers/:id/services).
  const servicesQuery = useQuery({
    queryKey: ["provider", id, "services"],
    queryFn: ({ signal }) => fetchServices(id as string, signal),
    enabled: !!id && !!provider && provider.type === "service",
    retry: retryUnlessNotFound,
  });
  const services = servicesQuery.data ?? [];
  const servicesLoading = servicesQuery.isPending && servicesQuery.fetchStatus !== "idle";
  const dayOptions = upcomingDays(7);

  // A store's link opened as a service provider: show the store page instead.
  useEffect(() => {
    if (provider && provider.type !== "service") {
      router.replace({ pathname: "/store/[id]", params: { id: provider.id } });
    }
  }, [provider?.type, provider?.id]);

  // Booking modal state
  const [bookOpen, setBookOpen] = useState(false);
  const [serviceIdx, setServiceIdx] = useState(0);
  const [dateIso, setDateIso] = useState(dayOptions[0]?.iso ?? "");
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[0]);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);

  const confirmBooking = async () => {
    if (!provider) return;
    if (!address.trim()) {
      Alert.alert("Address required", "Please add the address where the service should be performed.");
      return;
    }
    const option = services[serviceIdx] ?? services[0];
    if (!option) {
      Alert.alert("No services yet", "This provider hasn't listed any services to book yet.");
      return;
    }
    setBooking(true);
    try {
      await bookService({
        providerId: provider.id,
        providerName: provider.name,
        serviceName: option.name,
        priceRange: option.priceRange,
        date: dateIso,
        timeSlot,
        address: address.trim(),
        notes: notes.trim(),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setBooked(true);
      setAddress("");
      setNotes("");
    } finally {
      setBooking(false);
    }
  };

  // Message modal state
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgName, setMsgName] = useState("");
  const [msgEmail, setMsgEmail] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendMessage = async () => {
    if (!msgName.trim() || !msgEmail.trim() || !msgBody.trim()) {
      Alert.alert("Missing fields", "Please fill in all fields.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${getBaseUrl()}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: msgName,
          email: msgEmail,
          message: msgBody,
          providerId: provider?.id,
          providerName: provider?.name,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
    } catch {
      Alert.alert("Send Failed", "Could not send your message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const styles = useThemedStyles(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    imageWrap: { position: "relative" as const },
    heroImage: { width: "100%" as const, height: 220 },
    backBtn: {
      position: "absolute" as const,
      top: isWeb ? 67 : insets.top + 8,
      left: 16,
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: "rgba(0,0,0,0.4)",
      alignItems: "center", justifyContent: "center",
    },
    content: { padding: 20 },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    name: { fontSize: 22, fontWeight: "700" as const, color: colors.foreground, fontFamily: "Inter_700Bold", flex: 1 },
    badge: {
      backgroundColor: colors.primary + "20", borderRadius: 12,
      paddingHorizontal: 10, paddingVertical: 4, marginBottom: 14,
      alignSelf: "flex-start" as const,
    },
    badgeText: { fontSize: 12, color: colors.primary, fontFamily: "Inter_600SemiBold" },
    ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    ratingText: { fontSize: 15, fontWeight: "600" as const, color: "#f59e0b", fontFamily: "Inter_600SemiBold" },
    desc: { fontSize: 14, color: colors.mutedForeground, lineHeight: 20, fontFamily: "Inter_400Regular", marginBottom: 20 },
    infoRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
    infoText: { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", flex: 1 },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 20 },
    btnRow: { flexDirection: "row", gap: 12, marginTop: 8 },
    primaryBtn: {
      flex: 1, backgroundColor: colors.primary, borderRadius: 14,
      paddingVertical: 14, alignItems: "center",
    },
    primaryBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
    secondaryBtn: {
      flex: 1, backgroundColor: colors.secondary, borderRadius: 14,
      paddingVertical: 14, alignItems: "center",
      borderWidth: 1, borderColor: colors.border,
    },
    secondaryBtnText: { fontSize: 15, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    footer: { height: isWeb ? 34 : insets.bottom + 20 },
    // Modal styles
    modalOverlay: {
      flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 24, paddingBottom: isWeb ? 32 : insets.bottom + 24,
      maxHeight: "90%",
    },
    modalHandle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: colors.border, alignSelf: "center", marginBottom: 16,
    },
    modalTitle: { fontSize: 18, fontWeight: "700" as const, color: colors.foreground, fontFamily: "Inter_700Bold", marginBottom: 4 },
    modalSub: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginBottom: 20 },
    label: { fontSize: 13, fontWeight: "600" as const, color: colors.foreground, fontFamily: "Inter_600SemiBold", marginBottom: 5 },
    input: {
      backgroundColor: colors.secondary,
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
      fontSize: 14, color: colors.foreground, fontFamily: "Inter_400Regular",
      marginBottom: 14, borderWidth: 1, borderColor: colors.border,
    },
    textArea: { height: 90, textAlignVertical: "top" as const },
    sendBtn: {
      backgroundColor: colors.primary, borderRadius: 12,
      paddingVertical: 14, alignItems: "center",
      flexDirection: "row", justifyContent: "center", gap: 8,
    },
    sendBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
    successBox: { alignItems: "center", padding: 24, gap: 10 },
    successTitle: { fontSize: 18, fontWeight: "700" as const, color: colors.foreground, fontFamily: "Inter_700Bold" },
    successSub: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" as const },
    closeBtn: {
      marginTop: 8, paddingVertical: 10, paddingHorizontal: 28,
      borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    },
    closeBtnText: { fontSize: 14, color: colors.foreground, fontFamily: "Inter_500Medium" },
    errorBox: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40, gap: 16 },
    errorText: { fontSize: 18, fontWeight: "600" as const, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    // Booking sheet
    modalScroll: { flexGrow: 0, flexShrink: 1 },
    chipWrap: { flexDirection: "row", flexWrap: "wrap" as const, gap: 8, marginBottom: 4 },
    chip: {
      flexGrow: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.secondary, paddingVertical: 10, paddingHorizontal: 12, gap: 2,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 13, color: colors.foreground, fontFamily: "Inter_500Medium" },
    chipTextActive: { color: "#fff" },
    chipPrice: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    labelSpaced: { marginTop: 14 },
    dateRow: { gap: 8, paddingVertical: 2 },
    dateChip: {
      width: 56, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.secondary, alignItems: "center", paddingVertical: 8, gap: 2,
    },
    dateDay: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    dateNum: { fontSize: 16, color: colors.foreground, fontFamily: "Inter_700Bold" },
    viewBookingsBtn: {
      backgroundColor: colors.primary, borderRadius: 12,
      paddingVertical: 12, paddingHorizontal: 24, alignItems: "center", marginTop: 8,
    },
    viewBookingsText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
    centered: { flex: 1, justifyContent: "center", backgroundColor: colors.background },
    closedText: { color: colors.destructive },
    sectionTitle: { fontSize: 17, color: colors.foreground, fontFamily: "Inter_600SemiBold", marginBottom: 12 },
    serviceRow: {
      backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
      padding: 14, marginBottom: 10, gap: 4,
    },
    serviceName: { fontSize: 15, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    serviceDesc: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", lineHeight: 18 },
    serviceMeta: { fontSize: 13, color: colors.primary, fontFamily: "Inter_500Medium" },
    mutedNote: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginBottom: 12 },
    primaryBtnDisabled: { opacity: 0.5 },
  }));

  if (!provider && providerState.loading) {
    return (
      <View style={styles.centered}>
        <LoadingBlock label="Loading provider…" />
      </View>
    );
  }

  if (!provider && providerState.error) {
    return (
      <View style={styles.centered}>
        <LoadError
          title="Couldn't load this provider"
          message={providerState.error instanceof ApiError ? providerState.error.message : null}
          onRetry={providerState.retry}
          retrying={providerState.retrying}
        />
        <Pressable onPress={() => router.back()} style={{ alignSelf: "center" }}>
          <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium" }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (!provider) {
    return (
      <View style={styles.errorBox}>
        <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
        <Text style={styles.errorText}>Provider not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium" }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container}>
        <View style={styles.imageWrap}>
          <Image
            source={{ uri: provider.imageUrl }}
            style={styles.heroImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.row}>
            <Text style={styles.name}>{provider.name}</Text>
            <View style={styles.ratingRow}>
              <Feather name="star" size={18} color="#f59e0b" />
              <Text style={styles.ratingText}>{Number(provider.rating ?? 0).toFixed(1)}</Text>
            </View>
          </View>

          {catName ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{catName}</Text>
            </View>
          ) : null}

          {provider.description ? <Text style={styles.desc}>{provider.description}</Text> : null}

          {provider.location.address ? (
            <View style={styles.infoRow}>
              <Feather name="map-pin" size={18} color={colors.primary} />
              <Text style={styles.infoText}>{provider.location.address}</Text>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <Feather name="clock" size={18} color={provider.isOpen ? "#16a34a" : colors.destructive} />
            <Text style={[styles.infoText, !provider.isOpen && styles.closedText]}>{openStatusLabel(provider)}</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Services</Text>
          {servicesLoading ? (
            <LoadingBlock label="Loading services…" />
          ) : servicesQuery.isError ? (
            <LoadError
              title="Couldn't load services"
              message={servicesQuery.error instanceof ApiError ? servicesQuery.error.message : null}
              onRetry={() => void servicesQuery.refetch()}
              retrying={servicesQuery.isFetching}
            />
          ) : services.length === 0 ? (
            <Text style={styles.mutedNote}>This provider hasn't listed any services yet.</Text>
          ) : (
            services.map((service) => (
              <View key={service.id} style={styles.serviceRow}>
                <Text style={styles.serviceName}>{service.name}</Text>
                {service.description ? <Text style={styles.serviceDesc}>{service.description}</Text> : null}
                <Text style={styles.serviceMeta}>
                  {service.duration ? `${service.priceRange} · ${service.duration}` : service.priceRange}
                </Text>
              </View>
            ))
          )}

          <View style={styles.btnRow}>
            <Pressable
              style={[styles.primaryBtn, services.length === 0 && styles.primaryBtnDisabled]}
              disabled={services.length === 0}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setBooked(false);
                setBookOpen(true);
              }}
            >
              <Text style={styles.primaryBtnText}>Book Now</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSent(false);
                setMsgOpen(true);
              }}
            >
              <Text style={styles.secondaryBtnText}>Message</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.footer} />
      </ScrollView>

      {/* Message bottom sheet */}
      <Modal visible={msgOpen} transparent animationType="slide" onRequestClose={() => setMsgOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setMsgOpen(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            {sent ? (
              <View style={styles.successBox}>
                <Feather name="check-circle" size={52} color="#22c55e" />
                <Text style={styles.successTitle}>Message Sent!</Text>
                <Text style={styles.successSub}>The provider will get back to you soon.</Text>
                <Pressable style={styles.closeBtn} onPress={() => setMsgOpen(false)}>
                  <Text style={styles.closeBtnText}>Close</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.modalTitle}>Message {provider.name}</Text>
                <Text style={styles.modalSub}>Your message will be forwarded to the provider.</Text>
                <Text style={styles.label}>Your Name</Text>
                <TextInput style={styles.input} value={msgName} onChangeText={setMsgName} placeholder="Full name" placeholderTextColor={colors.mutedForeground} />
                <Text style={styles.label}>Email</Text>
                <TextInput style={styles.input} value={msgEmail} onChangeText={setMsgEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={colors.mutedForeground} />
                <Text style={styles.label}>Message</Text>
                <TextInput style={[styles.input, styles.textArea]} value={msgBody} onChangeText={setMsgBody} placeholder={`Hi ${provider.name}, I'd like to enquire about...`} multiline placeholderTextColor={colors.mutedForeground} />
                <Pressable style={styles.sendBtn} onPress={handleSendMessage} disabled={sending}>
                  {sending
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Feather name="send" size={16} color="#fff" />
                  }
                  <Text style={styles.sendBtnText}>{sending ? "Sending…" : "Send Message"}</Text>
                </Pressable>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Booking bottom sheet */}
      <Modal visible={bookOpen} transparent animationType="slide" onRequestClose={() => setBookOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setBookOpen(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            {booked ? (
              <View style={styles.successBox}>
                <Feather name="check-circle" size={52} color="#22c55e" />
                <Text style={styles.successTitle}>Booking Confirmed!</Text>
                <Text style={styles.successSub}>
                  {services[serviceIdx]?.name ?? "Service"} with {provider.name} on{" "}
                  {(() => {
                    const day = dayOptions.find((d) => d.iso === dateIso);
                    return day ? `${day.label} ${day.day}` : dateIso;
                  })()}{" "}
                  • {timeSlot}
                </Text>
                <Pressable
                  style={styles.viewBookingsBtn}
                  onPress={() => {
                    setBookOpen(false);
                    router.push("/bookings");
                  }}
                >
                  <Text style={styles.viewBookingsText}>View My Bookings</Text>
                </Pressable>
                <Pressable style={styles.closeBtn} onPress={() => setBookOpen(false)}>
                  <Text style={styles.closeBtnText}>Done</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
                <Text style={styles.modalTitle}>Book {provider.name}</Text>
                <Text style={styles.modalSub}>Pick a service, date and time that works for you.</Text>

                <Text style={styles.label}>Service</Text>
                <View style={styles.chipWrap}>
                  {services.map((service, i) => (
                    <Pressable
                      key={service.id}
                      style={[styles.chip, i === serviceIdx && styles.chipActive]}
                      onPress={() => setServiceIdx(i)}
                    >
                      <Text style={[styles.chipText, i === serviceIdx && styles.chipTextActive]}>{service.name}</Text>
                      <Text style={[styles.chipPrice, i === serviceIdx && styles.chipTextActive]}>
                        {service.duration ? `${service.priceRange} · ${service.duration}` : service.priceRange}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.label, styles.labelSpaced]}>Date</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
                  {dayOptions.map((day) => (
                    <Pressable
                      key={day.iso}
                      style={[styles.dateChip, day.iso === dateIso && styles.chipActive]}
                      onPress={() => setDateIso(day.iso)}
                    >
                      <Text style={[styles.dateDay, day.iso === dateIso && styles.chipTextActive]}>{day.label}</Text>
                      <Text style={[styles.dateNum, day.iso === dateIso && styles.chipTextActive]}>{day.day}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Text style={[styles.label, styles.labelSpaced]}>Time slot</Text>
                <View style={styles.chipWrap}>
                  {TIME_SLOTS.map((slot) => (
                    <Pressable
                      key={slot}
                      style={[styles.chip, slot === timeSlot && styles.chipActive]}
                      onPress={() => setTimeSlot(slot)}
                    >
                      <Text style={[styles.chipText, slot === timeSlot && styles.chipTextActive]}>{slot}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.label, styles.labelSpaced]}>Service address</Text>
                <TextInput
                  style={styles.input}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="House 12, Street 4, Gulberg III, Lahore"
                  placeholderTextColor={colors.mutedForeground}
                />

                <Text style={styles.label}>Notes (optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Describe the issue or any special requests."
                  multiline
                  placeholderTextColor={colors.mutedForeground}
                />

                <Pressable style={styles.sendBtn} onPress={confirmBooking} disabled={booking}>
                  {booking
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Feather name="calendar" size={16} color="#fff" />
                  }
                  <Text style={styles.sendBtnText}>{booking ? "Booking…" : "Confirm Booking"}</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
