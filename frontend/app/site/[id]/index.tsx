import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSession } from "@/src/session";
import { Site, Visit } from "@/src/api";
import { districtName } from "@/src/districts";
import { useTheme, spacing, sizes, type } from "@/src/theme";
import SyncBar from "@/src/components/SyncBar";

export default function SiteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette: colors } = useTheme();
  const styles = makeStyles(colors);
  const { api } = useSession();
  const router = useRouter();
  const [site, setSite] = useState<Site | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newNote, setNewNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    if (!api || !id) return;
    setError("");
    try { const [s, v] = await Promise.all([api.getSite(id), api.listVisits(id)]); setSite(s); setVisits(v); }
    catch (e: any) { setError(e?.message || "Failed to load site"); }
    finally { setLoading(false); }
  }, [api, id]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const toggleStatus = async () => {
    if (!api || !site) return;
    setUpdating(true);
    try { const next = site.status === "Active" ? "Completed" : "Active"; const updated = await api.updateSite(site.id, { status: next }); setSite(updated); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); }
    catch { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); }
    finally { setUpdating(false); }
  };

  const submitVisit = async () => {
    if (!api || !site) return;
    setBusy(true);
    try {
      const created = await api.createVisit(site.id, { title: newTitle.trim() || undefined, note: newNote.trim() });
      setVisits(prev => [...prev, created]);
      setSite(prev => prev ? { ...prev, visit_count: prev.visit_count + 1 } : prev);
      setAddOpen(false); setNewTitle(""); setNewNote("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); }
    finally { setBusy(false); }
  };

  if (loading) return <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top"]}><View style={styles.centerFill}><ActivityIndicator color={colors.borderStrong} /></View></SafeAreaView>;
  if (error || !site) return <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top"]}><View style={styles.centerFill}><Text style={[styles.errorText, { color: colors.error }]}>{(error || "SITE NOT FOUND").toUpperCase()}</Text><Pressable onPress={() => router.back()} style={[styles.retryBtn, { borderColor: colors.borderStrong }]}><Text style={[styles.retryText, { color: colors.onSurface }]}>GO BACK</Text></Pressable></View></SafeAreaView>;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top"]}>
      <SyncBar />
      <View style={[styles.header, { borderBottomColor: colors.borderStrong }]}>
        <Pressable onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/(app)"); }} hitSlop={12}><Ionicons name="arrow-back" size={22} color={colors.onSurface} /></Pressable>
        <Text style={[styles.headerLabel, { color: colors.onSurface }]}>SITE DETAIL</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.hero}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>{districtName(site.district).toUpperCase()}{site._pending ? "  · PENDING SYNC" : ""}</Text>
          <Text style={[styles.siteName, { color: colors.onSurface }]}>{site.name.toUpperCase()}</Text>
          <Text style={[styles.sitePlot, { color: colors.muted }]}>PLOT · {site.plot_number}</Text>
          {site.location ? <Text style={[styles.siteLocation, { color: colors.onSurface }]}>{site.location}</Text> : null}
        </View>

        <View style={[styles.metricRow, { borderColor: colors.borderStrong }]}>
          <View style={[styles.metricBox, { borderRightColor: colors.borderStrong }]}><Text style={[styles.metricLabel, { color: colors.muted }]}>STATUS</Text><Text style={[styles.metricValue, { color: colors.onSurface }]}>{site.status === "Active" ? "ONGOING" : "COMPLETE"}</Text></View>
          <View style={[styles.metricBox, { borderRightColor: colors.borderStrong }]}><Text style={[styles.metricLabel, { color: colors.muted }]}>VISITS</Text><Text style={[styles.metricValue, { color: colors.onSurface }]}>{site.visit_count}</Text></View>
          <View style={[styles.metricBox, { borderRightWidth: 0 }]}><Text style={[styles.metricLabel, { color: colors.muted }]}>PHOTOS</Text><Text style={[styles.metricValue, { color: colors.onSurface }]}>{site.photo_count}</Text></View>
        </View>

        <Pressable onPress={toggleStatus} disabled={updating} style={({ pressed }) => [styles.statusBtn, site.status === "Completed" ? [styles.statusBtnActive, { backgroundColor: colors.brand }] : [styles.statusBtnCompleted, { backgroundColor: colors.onSurface }], pressed && { opacity: 0.7 }]}>
          {updating ? <ActivityIndicator color={colors.onSurfaceInverse} /> : <Text style={[styles.statusBtnText, { color: site.status === "Completed" ? colors.onBrand : colors.onSurfaceInverse }]}>{site.status === "Active" ? "MARK COMPLETE →" : "MARK AS ONGOING"}</Text>}
        </Pressable>

        <View style={[styles.sectionHeader, { borderColor: colors.borderStrong }]}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>SITE VISITS</Text>
          <Text style={[styles.sectionCount, { color: colors.muted }]}>{visits.length} TOTAL</Text>
        </View>

        {visits.length === 0 ? <View style={[styles.emptyVisits, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary }]}><Ionicons name="footsteps-outline" size={44} color={colors.onSurface} /><Text style={[styles.emptyVisitsTitle, { color: colors.onSurface }]}>NO VISITS YET</Text><Text style={[styles.emptyVisitsBody, { color: colors.muted }]}>Each site is normally visited 3–4 times. Add the first visit to start capturing photos.</Text></View> : visits.map(v => <Pressable key={v.id} onPress={() => router.push(`/site/${site.id}/visit/${v.id}`)} style={({ pressed }) => [styles.visitRow, { borderBottomColor: colors.borderStrong }, pressed && { backgroundColor: colors.surfaceSecondary }]}>
          <View style={[styles.visitBadge, { backgroundColor: colors.onSurface }]}><Text style={[styles.visitBadgeText, { color: colors.onSurfaceInverse }]}>{String(v.sequence).padStart(2, "0")}</Text></View>
          <View style={{ flex: 1 }}>
            <View style={styles.visitTitleRow}><Text style={[styles.visitTitle, { color: colors.onSurface }]} numberOfLines={1}>{v.title.toUpperCase()}</Text>{v._pending ? <View style={[styles.pendingPill, { borderColor: colors.brandSecondary, backgroundColor: colors.brandSecondary }]}><Ionicons name="time-outline" size={12} color={colors.onSurface} /><Text style={[styles.pendingPillText, { color: colors.onSurface }]}>PENDING</Text></View> : null}</View>
            <Text style={[styles.visitMeta, { color: colors.muted }]}>{new Date(v.created_at).toLocaleDateString()} · {v.photo_count} PHOTOS</Text>
            {v.note ? <Text style={[styles.visitNote, { color: colors.onSurface }]} numberOfLines={2}>{v.note}</Text> : null}
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.onSurface} />
        </Pressable>)}
      </ScrollView>

      <View style={[styles.captureBarWrap, { borderTopColor: colors.borderStrong, backgroundColor: colors.surface }]}>
        <Pressable onPress={() => setAddOpen(true)} style={({ pressed }) => [styles.captureBar, { backgroundColor: colors.brand }, pressed && { backgroundColor: "#CC4400" }]}>
          <Ionicons name="add" size={22} color={colors.onBrand} />
          <Text style={[styles.captureBarText, { color: colors.onBrand }]}>ADD VISIT →</Text>
        </Pressable>
      </View>

      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.modalBackdrop, { backgroundColor: "rgba(0,0,0,0.6)" }]}>
          <Pressable style={{ flex: 1 }} onPress={() => setAddOpen(false)} />
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderTopColor: colors.borderStrong }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderStrong }]}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>NEW SITE VISIT</Text>
              <Pressable onPress={() => setAddOpen(false)}><Ionicons name="close" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <View style={[styles.modalBody, { backgroundColor: colors.surface }]}>
              <Text style={[styles.label, { color: colors.onSurface }]}>TITLE (OPTIONAL)</Text>
              <TextInput value={newTitle} onChangeText={setNewTitle} placeholder={`Visit ${visits.length + 1}`} placeholderTextColor={colors.muted} style={[styles.input, { borderColor: colors.borderStrong, color: colors.onSurface }]} />
              <Text style={[styles.label, { color: colors.onSurface }]}>SITE NOTE</Text>
              <TextInput value={newNote} onChangeText={setNewNote} placeholder="Observations, progress, issues encountered..." placeholderTextColor={colors.muted} multiline textAlignVertical="top" style={[styles.input, { borderColor: colors.borderStrong, color: colors.onSurface, minHeight: 120, paddingTop: 12 }]} />
              <Pressable onPress={submitVisit} disabled={busy} style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.brand }, pressed && { backgroundColor: "#CC4400" }, busy && { opacity: 0.6 }]}>
                {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={[styles.primaryBtnText, { color: colors.onBrand }]}>SAVE VISIT →</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 2 },
  headerLabel: { fontFamily: type.mono, fontWeight: "800", letterSpacing: 2, fontSize: sizes.sm },
  hero: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: 4 },
  eyebrow: { fontFamily: type.mono, fontSize: sizes.sm - 1, letterSpacing: 1.5, fontWeight: "800" },
  siteName: { fontSize: 32, fontWeight: "900", letterSpacing: -1, marginTop: 4 },
  sitePlot: { fontFamily: type.mono, fontSize: sizes.base, marginTop: 4, letterSpacing: 1 },
  siteLocation: { fontFamily: type.mono, fontSize: sizes.base },
  metricRow: { flexDirection: "row", borderTopWidth: 2, borderBottomWidth: 2 },
  metricBox: { flex: 1, padding: spacing.md, borderRightWidth: 2, gap: 4 },
  metricLabel: { fontFamily: type.mono, fontSize: sizes.sm - 1, letterSpacing: 1 },
  metricValue: { fontFamily: type.mono, fontSize: sizes.lg, fontWeight: "900" },
  statusBtn: { marginHorizontal: spacing.lg, marginTop: spacing.md, paddingVertical: 14, alignItems: "center", minHeight: 52, justifyContent: "center" },
  statusBtnText: { fontWeight: "900", letterSpacing: 1, fontSize: sizes.base },
  sectionHeader: { marginTop: spacing.xl, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 2, borderBottomWidth: 2, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontWeight: "900", letterSpacing: 1 },
  sectionCount: { fontFamily: type.mono, fontSize: sizes.sm, letterSpacing: 1 },
  emptyVisits: { margin: spacing.lg, borderWidth: 2, padding: spacing.xl, alignItems: "center", gap: spacing.sm },
  emptyVisitsTitle: { fontSize: sizes.lg, fontWeight: "900", letterSpacing: 1 },
  emptyVisitsBody: { fontFamily: type.mono, textAlign: "center", fontSize: sizes.sm },
  visitRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 2 },
  visitBadge: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  visitBadgeText: { fontFamily: type.mono, fontWeight: "900", fontSize: sizes.lg },
  visitTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  visitTitle: { fontSize: sizes.lg, fontWeight: "900", letterSpacing: -0.5, flexShrink: 1 },
  visitMeta: { fontFamily: type.mono, fontSize: sizes.sm - 1, marginTop: 2, letterSpacing: 1 },
  visitNote: { fontSize: sizes.sm, marginTop: 4 },
  pendingPill: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 2, paddingHorizontal: 6, paddingVertical: 2 },
  pendingPillText: { fontFamily: type.mono, fontSize: sizes.sm - 2, fontWeight: "900", letterSpacing: 1 },
  captureBarWrap: { position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.md, borderTopWidth: 2 },
  captureBar: { paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, minHeight: 56 },
  captureBarText: { fontWeight: "900", letterSpacing: 1, fontSize: sizes.base },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  errorText: { fontFamily: type.mono, fontSize: sizes.sm, textAlign: "center" },
  retryBtn: { borderWidth: 2, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  retryText: { fontFamily: type.mono, fontWeight: "800", letterSpacing: 1 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end" },
  modalSheet: { borderTopWidth: 2 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md, borderBottomWidth: 2 },
  modalTitle: { fontWeight: "900", letterSpacing: 1, fontFamily: type.mono },
  modalBody: { padding: spacing.lg, gap: spacing.md },
  label: { fontFamily: type.mono, fontSize: sizes.sm, letterSpacing: 1, fontWeight: "800" },
  input: { borderWidth: 2, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: sizes.base, fontFamily: type.mono },
  primaryBtn: { paddingVertical: 16, alignItems: "center", minHeight: 56, marginTop: spacing.sm },
  primaryBtnText: { fontWeight: "900", letterSpacing: 1, fontSize: sizes.base },
});
