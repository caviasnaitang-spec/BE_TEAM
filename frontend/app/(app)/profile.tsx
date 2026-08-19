import { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSession } from "@/src/session";
import { useTheme, spacing, sizes, type } from "@/src/theme";

export default function ProfileScreen() {
  const { palette: colors, mode, toggle } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session, signOut, online, pendingCount, syncNow, api } = useSession();
  const [seeding, setSeeding] = useState(false);
  const [lastSeedResult, setLastSeedResult] = useState("");

  const doSignOut = async () => { Haptics.selectionAsync().catch(() => {}); await signOut(); };
  const doReseed = async () => {
    if (!api) return;
    setSeeding(true);
    try {
      const res = await api.seedMeghalaya();
      setLastSeedResult(res.inserted === 0 ? `Already seeded (${res.total} sites)` : `Seeded ${res.inserted} sites (total ${res.total})`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      setLastSeedResult(e?.message || "Seed failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally { setSeeding(false); }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top"]}>
      <View style={[styles.header, { borderBottomColor: colors.borderStrong }]}>
        <Text style={[styles.title, { color: colors.onSurface }]}>PROFILE</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>ENGINEER ACCOUNT</Text>
      </View>

      <View style={[styles.body, { backgroundColor: colors.surface }]}>
        <View style={[styles.accountCard, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary }]}>
          <View style={[styles.avatar, { backgroundColor: colors.brand }]}>
            <Text style={[styles.avatarText, { color: colors.onBrand }]}>{(session?.user.email || "?").charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.accountName, { color: colors.onSurface }]}>{session?.user.name || session?.user.email || "Engineer"}</Text>
            <Text style={[styles.accountEmail, { color: colors.muted }]}>{session?.user.email}</Text>
          </View>
        </View>

        <Pressable onPress={toggle} style={({ pressed }) => [styles.themeRow, { borderColor: colors.borderStrong }, pressed && { backgroundColor: colors.surfaceSecondary }]}>
          <View style={[styles.themeIconWrap, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name={mode === "dark" ? "moon" : "sunny"} size={22} color={colors.onSurface} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.onSurface }]}>APPEARANCE</Text>
            <Text style={[styles.rowSub, { color: colors.muted }]}>{mode === "dark" ? "Dark mode" : "Light mode"}</Text>
          </View>
          <View style={[styles.themeSwitchTrack, { backgroundColor: colors.surfaceTertiary, borderColor: colors.borderStrong }]}>
            <View style={[styles.themeSwitchThumb, { backgroundColor: colors.onSurface }, mode === "dark" ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" }]} />
          </View>
        </Pressable>

        <View style={[styles.listRow, { borderColor: colors.borderStrong }]}>
          <Ionicons name={online ? "cloud-done-outline" : "cloud-offline-outline"} size={22} color={colors.onSurface} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.onSurface }]}>SYNC</Text>
            <Text style={[styles.rowSub, { color: colors.muted }]}>{online ? "Online" : "Offline"}{pendingCount > 0 ? `  ·  ${pendingCount} pending` : ""}</Text>
          </View>
          {pendingCount > 0 && online ? <Pressable onPress={syncNow} style={[styles.smallBtn, { borderColor: colors.borderStrong }]}><Text style={[styles.smallBtnText, { color: colors.onSurface }]}>SYNC</Text></Pressable> : null}
        </View>

        <Pressable onPress={doReseed} disabled={seeding} style={({ pressed }) => [styles.actionRow, { borderColor: colors.borderStrong }, pressed && { backgroundColor: colors.surfaceSecondary }, seeding && { opacity: 0.6 }]}>
          <Ionicons name="download-outline" size={22} color={colors.onSurface} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.onSurface }]}>RE-SEED MEGHALAYA SITES</Text>
            <Text style={[styles.rowSub, { color: colors.muted }]}>{lastSeedResult || "Restores the canonical 84-site list (no-op if data exists)."}</Text>
          </View>
          {seeding ? <ActivityIndicator color={colors.onSurface} /> : <Ionicons name="chevron-forward" size={20} color={colors.onSurface} />}
        </Pressable>

        <View style={[styles.listRow, { borderColor: colors.borderStrong }]}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.onSurface} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.onSurface }]}>SESSION</Text>
            <Text style={[styles.rowSub, { color: colors.muted }]}>Encrypted with SecureStore</Text>
          </View>
        </View>

        <Pressable onPress={doSignOut} style={({ pressed }) => [styles.logoutBtn, { backgroundColor: colors.error }, pressed && { backgroundColor: "#CC0000" }]}>
          <Text style={[styles.logoutText, { color: colors.onError }]}>LOG OUT →</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 2 },
  title: { fontSize: 32, fontWeight: "900", letterSpacing: -1 },
  subtitle: { fontFamily: type.mono, fontSize: sizes.sm, letterSpacing: 1, marginTop: 2 },
  body: { padding: spacing.lg, gap: spacing.md },
  accountCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 2, padding: spacing.md },
  avatar: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 28, fontWeight: "900" },
  accountName: { fontSize: sizes.lg, fontWeight: "900" },
  accountEmail: { fontFamily: type.mono, fontSize: sizes.sm, marginTop: 2 },
  themeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderWidth: 2 },
  themeIconWrap: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  themeSwitchTrack: { width: 52, height: 28, borderWidth: 2, justifyContent: "center", padding: 2 },
  themeSwitchThumb: { width: 20, height: 20 },
  listRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderWidth: 2 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderWidth: 2 },
  rowTitle: { fontWeight: "900", fontSize: sizes.base, letterSpacing: 1 },
  rowSub: { fontFamily: type.mono, fontSize: sizes.sm, marginTop: 2 },
  smallBtn: { borderWidth: 2, paddingHorizontal: 10, paddingVertical: 6 },
  smallBtnText: { fontFamily: type.mono, fontWeight: "900", fontSize: sizes.sm - 1, letterSpacing: 1 },
  logoutBtn: { paddingVertical: 18, alignItems: "center", marginTop: spacing.md, minHeight: 60, justifyContent: "center" },
  logoutText: { fontWeight: "900", letterSpacing: 1, fontSize: sizes.lg },
});
