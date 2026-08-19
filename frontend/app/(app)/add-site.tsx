import { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Modal } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSession } from "@/src/session";
import { DISTRICTS, districtName } from "@/src/districts";
import { useTheme, spacing, sizes, type } from "@/src/theme";

const STATUSES: Array<"Active" | "Completed"> = ["Active", "Completed"];

export default function AddSiteScreen() {
  const { palette: colors } = useTheme();
  const styles = makeStyles(colors);
  const { api } = useSession();
  const router = useRouter();
  const params = useLocalSearchParams<{ district?: string }>();
  const [name, setName] = useState("");
  const [plot, setPlot] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<"Active" | "Completed">("Active");
  const [district, setDistrict] = useState<string>(params.district || "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (params.district && params.district !== district) setDistrict(params.district); }, [params.district]);

  const submit = async () => {
    if (!api) return;
    if (!name.trim() || !plot.trim()) { setError("SITE NAME AND PLOT NUMBER ARE REQUIRED"); return; }
    if (!district) { setError("PLEASE SELECT A DISTRICT"); return; }
    setBusy(true); setError("");
    try {
      const created = await api.createSite({ name: name.trim(), plot_number: plot.trim(), district, location: location.trim(), status });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace(`/site/${created.id}`);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError((e?.message || "FAILED TO CREATE SITE").toUpperCase());
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top"]}>
      <View style={[styles.header, { borderBottomColor: colors.borderStrong }]}>
        <Text style={[styles.title, { color: colors.onSurface }]}>ADD SITE</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>NEW CONSTRUCTION RECORD</Text>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={[styles.body, { backgroundColor: colors.surface }]} keyboardShouldPersistTaps="handled">
          {error ? <View style={[styles.errorBanner, { borderColor: colors.error, backgroundColor: "#FFF0F0" }]}><Text style={[styles.errorText, { color: colors.error }]}>{error}</Text></View> : null}
          <Text style={[styles.label, { color: colors.onSurface }]}>DISTRICT</Text>
          <Pressable onPress={() => setPickerOpen(true)} style={[styles.pickerInput, { borderColor: colors.borderStrong }]}>
            <Text style={[styles.pickerText, { color: district ? colors.onSurface : colors.muted }]}>{district ? districtName(district).toUpperCase() : "SELECT DISTRICT"}</Text>
            <Ionicons name="chevron-down" size={20} color={colors.onSurface} />
          </Pressable>
          <Text style={[styles.label, { color: colors.onSurface }]}>SITE NAME</Text>
          <TextInput value={name} onChangeText={setName} placeholder="e.g. Anganwadi Centre Umsning" placeholderTextColor={colors.muted} style={[styles.input, { borderColor: colors.borderStrong, color: colors.onSurface }]} />
          <Text style={[styles.label, { color: colors.onSurface }]}>PLOT NUMBER</Text>
          <TextInput value={plot} onChangeText={setPlot} placeholder="e.g. PL-2317-A" placeholderTextColor={colors.muted} autoCapitalize="characters" style={[styles.input, { borderColor: colors.borderStrong, color: colors.onSurface }]} />
          <Text style={[styles.label, { color: colors.onSurface }]}>BLOCK / VILLAGE (OPTIONAL)</Text>
          <TextInput value={location} onChangeText={setLocation} placeholder="e.g. Umsning Block" placeholderTextColor={colors.muted} style={[styles.input, { borderColor: colors.borderStrong, color: colors.onSurface }]} />
          <Text style={[styles.label, { color: colors.onSurface }]}>STATUS</Text>
          <View style={styles.statusRow}>
            {STATUSES.map(s => {
              const active = status === s;
              return (
                <Pressable key={s} onPress={() => setStatus(s)} style={[styles.statusPill, { borderColor: colors.borderStrong }, active && (s === "Active" ? { backgroundColor: colors.brand, borderColor: colors.brand } : { backgroundColor: colors.onSurface, borderColor: colors.onSurface })]}>
                  <Text style={[styles.statusPillText, { color: active ? (s === "Active" ? colors.onBrand : colors.onSurfaceInverse) : colors.onSurface }]}>{s === "Active" ? "ONGOING" : "COMPLETE"}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={submit} disabled={busy} style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.brand }, pressed && { backgroundColor: "#CC4400" }, busy && { opacity: 0.6 }]}>
            {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={[styles.primaryBtnText, { color: colors.onBrand }]}>SAVE SITE →</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={[styles.modalBackdrop, { backgroundColor: "rgba(0,0,0,0.6)" }]} onPress={() => setPickerOpen(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]} onPress={() => {}}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderStrong }]}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>SELECT DISTRICT</Text>
              <Pressable onPress={() => setPickerOpen(false)}><Ionicons name="close" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <ScrollView style={{ maxHeight: 480 }}>
              {DISTRICTS.map(d => {
                const active = d.key === district;
                return (
                  <Pressable key={d.key} onPress={() => { setDistrict(d.key); setPickerOpen(false); }} style={[styles.optionRow, { borderBottomColor: colors.divider }, active && { backgroundColor: colors.brandSecondary }]}>
                    <Text style={[styles.optionText, { color: colors.onSurface }]}>{d.name.toUpperCase()}</Text>
                    {active ? <Ionicons name="checkmark" size={18} color={colors.onSurface} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 2 },
  title: { fontSize: 32, fontWeight: "900", letterSpacing: -1 },
  subtitle: { fontFamily: type.mono, fontSize: sizes.sm, letterSpacing: 1, marginTop: 2 },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  label: { fontFamily: type.mono, fontSize: sizes.sm, letterSpacing: 1, marginTop: spacing.sm, fontWeight: "800" },
  input: { borderWidth: 2, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: sizes.lg, fontFamily: type.mono, minHeight: 56 },
  pickerInput: { borderWidth: 2, paddingHorizontal: spacing.md, minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pickerText: { fontFamily: type.mono, fontSize: sizes.base, fontWeight: "800", letterSpacing: 1, flex: 1 },
  statusRow: { flexDirection: "row", gap: spacing.sm },
  statusPill: { borderWidth: 2, minHeight: 56, justifyContent: "center", flex: 1, alignItems: "center" },
  statusPillText: { fontFamily: type.mono, fontWeight: "800", letterSpacing: 1 },
  primaryBtn: { marginTop: spacing.lg, paddingVertical: 18, alignItems: "center", minHeight: 60 },
  primaryBtnText: { fontSize: sizes.lg, fontWeight: "800", letterSpacing: 1 },
  errorBanner: { borderWidth: 2, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  errorText: { fontFamily: type.mono, fontSize: sizes.sm },
  modalBackdrop: { flex: 1, padding: spacing.lg, justifyContent: "center" },
  modalSheet: { borderWidth: 2 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md, borderBottomWidth: 2 },
  modalTitle: { fontWeight: "900", letterSpacing: 1, fontFamily: type.mono },
  optionRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  optionText: { fontFamily: type.mono, fontWeight: "800", letterSpacing: 1 },
});
