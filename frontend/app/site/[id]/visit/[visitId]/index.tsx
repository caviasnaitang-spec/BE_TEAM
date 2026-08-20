import { useCallback, useState, useEffect, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Dimensions, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSession } from "@/src/session";
import { Photo, Visit } from "@/src/api";
import { useTheme, spacing, sizes, type } from "@/src/theme";
import SyncBar from "@/src/components/SyncBar";

const { width: SCREEN_W } = Dimensions.get("window");
const GRID_GAP = 2;
const TILE_SIZE = (SCREEN_W - GRID_GAP) / 2;

export default function VisitDetailScreen() {
  const { palette: colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { id: siteId, visitId } = useLocalSearchParams<{ id: string; visitId: string }>();
  const { api } = useSession();
  const router = useRouter();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState<Photo | null>(null);
  const [error, setError] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [progressDraft, setProgressDraft] = useState("");
  const [issuesDraft, setIssuesDraft] = useState("");
  const [recsDraft, setRecsDraft] = useState("");

  useEffect(() => {
    if (visit) {
      setNoteDraft(visit.note || "");
      setProgressDraft(visit.progress_pct == null ? "" : String(visit.progress_pct));
      setIssuesDraft(visit.issues || "");
      setRecsDraft(visit.recommendations || "");
    }
  }, [visit]);

  const load = useCallback(async () => {
    if (!api || !visitId) return;
    setError("");
    try { const [v, p] = await Promise.all([api.getVisit(visitId), api.listPhotos(visitId)]); setVisit(v); setPhotos(p); }
    catch (e: any) { setError(e?.message || "Failed to load visit"); }
    finally { setLoading(false); }
  }, [api, visitId]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const saveReport = async () => {
    if (!api || !visit) return;
    setSaving(true);
    try {
      const progress = progressDraft === "" ? null : Math.max(0, Math.min(100, parseInt(progressDraft, 10) || 0));
      const updated = await api.updateVisit(visit.id, { note: noteDraft.trim(), progress_pct: progress, issues: issuesDraft.trim(), recommendations: recsDraft.trim() });
      setVisit(updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setReportOpen(false);
    } catch { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); }
    finally { setSaving(false); }
  };

  if (loading) return <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top"]}><View style={styles.centerFill}><ActivityIndicator color={colors.borderStrong} /></View></SafeAreaView>;
  if (error || !visit) return <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top"]}><View style={styles.centerFill}><Text style={[styles.errorText, { color: colors.error }]}>{(error || "VISIT NOT FOUND").toUpperCase()}</Text><Pressable onPress={() => { if (router.canGoBack()) router.back(); else router.replace(`/site/${siteId}`); }} style={[styles.retryBtn, { borderColor: colors.borderStrong }]}><Text style={[styles.retryText, { color: colors.onSurface }]}>GO BACK</Text></Pressable></View></SafeAreaView>;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top"]}>
      <SyncBar />
      <View style={[styles.header, { borderBottomColor: colors.borderStrong }]}>
        <Pressable hitSlop={12} onPress={() => { if (router.canGoBack()) router.back(); else router.replace(`/site/${siteId}`); }}><Ionicons name="arrow-back" size={22} color={colors.onSurface} /></Pressable>
        <Text style={[styles.headerLabel, { color: colors.onSurface }]}>VISIT #{visit.sequence}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.hero}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>SEQUENCE {String(visit.sequence).padStart(2, "0")}{visit._pending ? "  · PENDING SYNC" : ""}</Text>
          <Text style={[styles.visitTitle, { color: colors.onSurface }]}>{visit.title.toUpperCase()}</Text>
          <Text style={[styles.captured, { color: colors.muted }]}>{new Date(visit.created_at).toLocaleString()}</Text>
        </View>

        <View style={[styles.metricRow, { borderColor: colors.borderStrong }]}>
          <View style={[styles.metricBox, { borderRightColor: colors.borderStrong }]}><Text style={[styles.metricLabel, { color: colors.muted }]}>PHOTOS</Text><Text style={[styles.metricValue, { color: colors.onSurface }]}>{photos.length}</Text></View>
          <View style={[styles.metricBox, { borderRightWidth: 0 }]}><Text style={[styles.metricLabel, { color: colors.muted }]}>DATE</Text><Text style={[styles.metricValue, { color: colors.onSurface }]}>{new Date(visit.created_at).toLocaleDateString()}</Text></View>
        </View>

        {/* VISIT REPORT CARD */}
        <View style={[styles.noteWrap, { borderColor: colors.borderStrong }]}>
          <View style={styles.reportHeader}>
            <Text style={[styles.noteLabel, { color: colors.muted }]}>VISIT REPORT</Text>
            <Pressable onPress={() => setReportOpen(true)} style={[styles.editReportBtn, { borderColor: colors.borderStrong }]}>
              <Text style={[styles.editReportBtnText, { color: colors.onSurface }]}>EDIT</Text>
              <Ionicons name="create-outline" size={14} color={colors.onSurface} />
            </Pressable>
          </View>
          <View style={styles.reportSection}>
            <Text style={[styles.reportSectionLabel, { color: colors.muted }]}>PROGRESS</Text>
            <View style={styles.progressRow}>
              <Text style={[styles.progressLabel, { color: colors.muted }]}>%</Text>
              <Text style={[styles.progressValue, { color: colors.onSurface }]}>{visit.progress_pct ?? "—"}</Text>
            </View>
            <View style={[styles.progressBar, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}>
              <View style={[styles.progressBarFill, { backgroundColor: colors.brand, width: `${Math.min(100, Math.max(0, visit.progress_pct || 0))}%` }]} />
            </View>
          </View>
          <View style={styles.reportSection}>
            <Text style={[styles.reportSectionLabel, { color: colors.muted }]}>SUMMARY</Text>
            <Text style={[styles.noteText, { color: colors.onSurface }]}>{visit.note || "No summary recorded."}</Text>
          </View>
          <View style={styles.reportSection}>
            <Text style={[styles.reportSectionLabel, { color: colors.muted }]}>ISSUES FOUND</Text>
            <Text style={[styles.noteText, { color: colors.onSurface }]}>{visit.issues || "No issues reported."}</Text>
          </View>
          <View style={styles.reportSection}>
            <Text style={[styles.reportSectionLabel, { color: colors.muted }]}>RECOMMENDATIONS</Text>
            <Text style={[styles.noteText, { color: colors.onSurface }]}>{visit.recommendations || "No recommendations provided."}</Text>
          </View>
        </View>

        <View style={[styles.sectionHeader, { borderColor: colors.borderStrong }]}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>GEOTAGGED PHOTOS</Text>
          <Text style={[styles.sectionCount, { color: colors.muted }]}>{photos.length} TOTAL</Text>
        </View>

        {photos.length === 0 ? <View style={[styles.emptyGallery, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary }]}><Ionicons name="camera-outline" size={44} color={colors.onSurface} /><Text style={[styles.emptyGalleryTitle, { color: colors.onSurface }]}>NO PHOTOS CAPTURED</Text><Text style={[styles.emptyGalleryBody, { color: colors.muted }]}>Capture a photo — date, time and GPS will be burned onto the image.</Text></View> : <View style={styles.grid}>{photos.map(p => <Pressable key={p.id} style={styles.tile} onPress={() => setViewer(p)}><Image source={{ uri: p.image_base64.startsWith("data:") ? p.image_base64 : `data:image/jpeg;base64,${p.image_base64}` }} style={styles.tileImg} contentFit="cover" />{p._pending ? <View style={[styles.tilePendingBadge, { backgroundColor: colors.brandSecondary }]}><Ionicons name="cloud-offline" size={12} color={colors.onSurface} /><Text style={[styles.tilePendingText, { color: colors.onSurface }]}>PENDING</Text></View> : null}</Pressable>)}</View>}
      </ScrollView>

      <View style={[styles.captureBarWrap, { borderTopColor: colors.borderStrong, backgroundColor: colors.surface }]}>
        <View style={styles.photoActions}>
          <Pressable
            onPress={() => router.push(`/site/${siteId}/visit/${visitId}/camera`)}
            style={({ pressed }) => [
              styles.captureBar,
              { backgroundColor: colors.brand },
              pressed && { opacity: 0.75 },
            ]}
          >
            <Ionicons name="camera" size={21} color={colors.onBrand} />
            <Text style={[styles.captureBarText, { color: colors.onBrand }]}>
              TAKE PHOTO
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push(`/site/${siteId}/visit/${visitId}/gallery`)}
            style={({ pressed }) => [
              styles.captureBar,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.borderStrong,
              },
              pressed && { opacity: 0.75 },
            ]}
          >
            <Ionicons name="images" size={21} color={colors.onSurface} />
            <Text style={[styles.captureBarText, { color: colors.onSurface }]}>
              GALLERY
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Photo viewer modal */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={[styles.viewerBackdrop, { backgroundColor: "rgba(0,0,0,0.95)" }]}>
          <Pressable style={styles.viewerClose} onPress={() => setViewer(null)} hitSlop={16}><Ionicons name="close" size={28} color={colors.onSurfaceInverse} /></Pressable>
          {viewer && <Image source={{ uri: viewer.image_base64.startsWith("data:") ? viewer.image_base64 : `data:image/jpeg;base64,${viewer.image_base64}` }} style={styles.viewerImg} contentFit="contain" />}
        </View>
      </Modal>

      {/* Report editor modal */}
      <Modal visible={reportOpen} transparent animationType="fade" onRequestClose={() => setReportOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.reportBackdrop, { backgroundColor: "rgba(0,0,0,0.6)" }]}>
          <Pressable style={{ flex: 1 }} onPress={() => setReportOpen(false)} />
          <View style={[styles.reportSheet, { backgroundColor: colors.surface, borderTopColor: colors.borderStrong }]}>
            <View style={[styles.reportSheetHeader, { borderBottomColor: colors.borderStrong }]}>
              <Text style={[styles.reportSheetTitle, { color: colors.onSurface }]}>WRITE VISIT REPORT</Text>
              <Pressable onPress={() => setReportOpen(false)}><Ionicons name="close" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={[styles.reportSheetBody, { backgroundColor: colors.surface }]} keyboardShouldPersistTaps="handled">
              <Text style={[styles.formLabel, { color: colors.onSurface }]}>PROGRESS % (0–100)</Text>
              <TextInput value={progressDraft} onChangeText={v => setProgressDraft(v.replace(/[^0-9]/g, "").slice(0, 3))} keyboardType="number-pad" placeholder="e.g. 45" placeholderTextColor={colors.muted} style={[styles.formInput, { borderColor: colors.borderStrong, color: colors.onSurface }]} />
              <Text style={[styles.formLabel, { color: colors.onSurface }]}>SUMMARY</Text>
              <TextInput value={noteDraft} onChangeText={setNoteDraft} placeholder="Brief overview of what you observed..." placeholderTextColor={colors.muted} multiline textAlignVertical="top" style={[styles.formInput, styles.formInputMulti, { borderColor: colors.borderStrong, color: colors.onSurface }]} />
              <Text style={[styles.formLabel, { color: colors.onSurface }]}>ISSUES FOUND</Text>
              <TextInput value={issuesDraft} onChangeText={setIssuesDraft} placeholder="Any problems, delays, quality concerns..." placeholderTextColor={colors.muted} multiline textAlignVertical="top" style={[styles.formInput, styles.formInputMulti, { borderColor: colors.borderStrong, color: colors.onSurface }]} />
              <Text style={[styles.formLabel, { color: colors.onSurface }]}>RECOMMENDATIONS</Text>
              <TextInput value={recsDraft} onChangeText={setRecsDraft} placeholder="What should be done before the next visit..." placeholderTextColor={colors.muted} multiline textAlignVertical="top" style={[styles.formInput, styles.formInputMulti, { borderColor: colors.borderStrong, color: colors.onSurface }]} />
              <Pressable onPress={saveReport} disabled={saving} style={({ pressed }) => [styles.reportSaveBtn, { backgroundColor: colors.brand }, pressed && { backgroundColor: "#CC4400" }, saving && { opacity: 0.6 }]}>
                {saving ? <ActivityIndicator color={colors.onBrand} /> : <Text style={[styles.reportSaveBtnText, { color: colors.onBrand }]}>SAVE REPORT →</Text>}
              </Pressable>
            </ScrollView>
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
  visitTitle: { fontSize: 30, fontWeight: "900", letterSpacing: -1, marginTop: 4 },
  captured: { fontFamily: type.mono, fontSize: sizes.sm, marginTop: 4, letterSpacing: 1 },
  metricRow: { flexDirection: "row", borderTopWidth: 2, borderBottomWidth: 2 },
  metricBox: { flex: 1, padding: spacing.md, borderRightWidth: 2, gap: 4 },
  metricLabel: { fontFamily: type.mono, fontSize: sizes.sm - 1, letterSpacing: 1 },
  metricValue: { fontFamily: type.mono, fontSize: sizes.lg, fontWeight: "900" },
  noteWrap: { marginTop: spacing.lg, marginHorizontal: spacing.lg, borderWidth: 2, padding: spacing.md, gap: 6 },
  noteLabel: { fontFamily: type.mono, fontSize: sizes.sm - 1, letterSpacing: 1, fontWeight: "800" },
  noteText: { fontSize: sizes.base, lineHeight: 20 },
  reportHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  editReportBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 2, paddingHorizontal: 8, paddingVertical: 4 },
  editReportBtnText: { fontFamily: type.mono, fontSize: sizes.sm - 1, fontWeight: "900", letterSpacing: 1 },
  reportSection: { marginTop: 12, gap: 4 },
  reportSectionLabel: { fontFamily: type.mono, fontSize: sizes.sm - 1, letterSpacing: 1, fontWeight: "800" },
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressLabel: { fontFamily: type.mono, fontSize: sizes.sm - 1, letterSpacing: 1, fontWeight: "800" },
  progressValue: { fontFamily: type.mono, fontSize: sizes.lg, fontWeight: "900" },
  progressBar: { height: 10, borderWidth: 2 },
  progressBarFill: { height: "100%" },
  reportBackdrop: { flex: 1, justifyContent: "flex-end" },
  reportSheet: { borderTopWidth: 2, maxHeight: "88%" },
  reportSheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md, borderBottomWidth: 2 },
  reportSheetTitle: { fontFamily: type.mono, fontWeight: "900", letterSpacing: 1 },
  reportSheetBody: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  formLabel: { fontFamily: type.mono, fontSize: sizes.sm, letterSpacing: 1, fontWeight: "800", marginTop: spacing.sm },
  formInput: { borderWidth: 2, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: sizes.base, fontFamily: type.mono, minHeight: 48 },
  formInputMulti: { minHeight: 90, paddingTop: 12 },
  reportSaveBtn: { paddingVertical: 16, alignItems: "center", minHeight: 56, marginTop: spacing.md },
  reportSaveBtnText: { fontWeight: "900", letterSpacing: 1, fontSize: sizes.base },

  sectionHeader: { marginTop: spacing.xl, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 2, borderBottomWidth: 2, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontWeight: "900", letterSpacing: 1 },
  sectionCount: { fontFamily: type.mono, fontSize: sizes.sm, letterSpacing: 1 },
  emptyGallery: { margin: spacing.lg, borderWidth: 2, padding: spacing.xl, alignItems: "center", gap: spacing.sm },
  emptyGalleryTitle: { fontSize: sizes.lg, fontWeight: "900", letterSpacing: 1 },
  emptyGalleryBody: { fontFamily: type.mono, textAlign: "center", fontSize: sizes.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP, padding: GRID_GAP },
  tile: { width: TILE_SIZE - GRID_GAP, height: TILE_SIZE - GRID_GAP, backgroundColor: colors.surfaceTertiary, position: "relative" },
  tileImg: { width: "100%", height: "100%" },
  tilePendingBadge: { position: "absolute", bottom: 6, left: 6, paddingHorizontal: 6, paddingVertical: 2, flexDirection: "row", alignItems: "center", gap: 4 },
  tilePendingText: { fontFamily: type.mono, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  captureBarWrap: { position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.md, borderTopWidth: 2 },
  photoActions: { flexDirection: "row", gap: spacing.sm },
  captureBar: { flex: 1, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, minHeight: 56, borderWidth: 2 },
  captureBarText: { fontWeight: "900", letterSpacing: 1, fontSize: sizes.sm },
  viewerBackdrop: { flex: 1, alignItems: "center", justifyContent: "center" },
  viewerImg: { width: "100%", height: "100%" },
  viewerClose: { position: "absolute", top: 40, right: 16, zIndex: 10, padding: 8 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  errorText: { fontFamily: type.mono, fontSize: sizes.sm, textAlign: "center" },
  retryBtn: { borderWidth: 2, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  retryText: { fontFamily: type.mono, fontWeight: "800", letterSpacing: 1 },
});
