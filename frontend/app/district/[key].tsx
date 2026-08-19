import { useCallback, useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TextInput } from "react-native";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/src/session";
import { Site } from "@/src/api";
import { districtName } from "@/src/districts";
import { useTheme, spacing, sizes, type } from "@/src/theme";
import SyncBar from "@/src/components/SyncBar";

type Filter = "All" | "Active" | "Completed";
const FILTERS: Filter[] = ["All", "Active", "Completed"];
const FILTER_LABEL: Record<Filter, string> = { All: "ALL", Active: "ONGOING", Completed: "COMPLETE" };

export default function DistrictSitesScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { palette: colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { api, online } = useSession();
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("All");

  const load = useCallback(async () => {
    if (!api || !key) return;
    setError("");
    try {
      const list = await api.listSites({ district: key, q: q || undefined, status: filter === "All" ? undefined : filter });
      setSites(list);
    } catch (e: any) { setError(e?.message || "Failed to load sites"); }
    finally { setLoading(false); setRefreshing(false); }
  }, [api, key, q, filter]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const renderItem = ({ item }: { item: Site }) => (
    <Pressable onPress={() => router.push(`/site/${item.id}`)} style={({ pressed }) => [styles.siteCard, { borderBottomColor: colors.borderStrong }, pressed && { backgroundColor: colors.surfaceSecondary }]}>
      <View style={styles.siteCardTop}>
        <View style={{ flex: 1, paddingRight: spacing.md }}>
          <Text style={[styles.siteName, { color: colors.onSurface }]} numberOfLines={2}>{item.name.toUpperCase()}</Text>
          <Text style={[styles.plot, { color: colors.muted }]}>PLOT · {item.plot_number}</Text>
          {item.location ? <Text style={[styles.locationText, { color: colors.onSurface }]}>{item.location}</Text> : null}
        </View>
        <View style={[styles.statusPill, item.status === "Completed" ? [styles.statusCompleted, { borderColor: colors.borderStrong, backgroundColor: colors.surface }] : [styles.statusActive, { borderColor: colors.brand, backgroundColor: colors.brand }]]}>
          <Text style={[styles.statusPillText, item.status === "Completed" ? [styles.statusCompletedText, { color: colors.onSurface }] : [styles.statusActiveText, { color: colors.onBrand }]]}>{item.status === "Active" ? "ONGOING" : "COMPLETE"}</Text>
        </View>
      </View>
      <View style={styles.siteMeta}>
        <View style={[styles.metaBox, { borderColor: colors.borderStrong }]}><Text style={[styles.metaLabel, { color: colors.muted }]}>VISITS</Text><Text style={[styles.metaValue, { color: colors.onSurface }]}>{item.visit_count}</Text></View>
        <View style={[styles.metaBox, { borderColor: colors.borderStrong }]}><Text style={[styles.metaLabel, { color: colors.muted }]}>PHOTOS</Text><Text style={[styles.metaValue, { color: colors.onSurface }]}>{item.photo_count}</Text></View>
        <View style={styles.metaArrow}><Ionicons name="arrow-forward" size={20} color={colors.onSurface} /></View>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top"]}>
      <SyncBar />
      <View style={[styles.header, { borderBottomColor: colors.borderStrong }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/(app)"); }} hitSlop={12}><Ionicons name="arrow-back" size={22} color={colors.onSurface} /></Pressable>
          <View style={{ flex: 1 }}><Text style={[styles.headerTitle, { color: colors.onSurface }]}>{districtName(key).toUpperCase()}</Text><Text style={[styles.headerSubtitle, { color: colors.muted }]}>{sites.length} SITES · {sites.filter(s => s.status === "Active").length} ONGOING</Text></View>
          <Pressable onPress={() => router.push(`/(app)/add-site?district=${key}`)} style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.brand }, pressed && { backgroundColor: "#CC4400" }]}><Ionicons name="add" size={24} color={colors.onBrand} /></Pressable>
        </View>
        <View style={[styles.searchWrap, { borderColor: colors.borderStrong }]}>
          <Ionicons name="search" size={18} color={colors.onSurface} style={{ marginRight: spacing.sm }} />
          <TextInput value={q} onChangeText={setQ} placeholder="SEARCH SITE / PLOT / LOCATION" placeholderTextColor={colors.muted} style={[styles.searchInput, { color: colors.onSurface }]} autoCapitalize="none" returnKeyType="search" onSubmitEditing={load} />
          {q ? <Pressable onPress={() => setQ("")}><Ionicons name="close" size={20} color={colors.onSurface} /></Pressable> : null}
        </View>
        <FlatList horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow} data={FILTERS} keyExtractor={f => f} renderItem={({ item: f }) => {
          const active = filter === f;
          return <Pressable onPress={() => setFilter(f)} style={[styles.chip, { borderColor: colors.borderStrong, backgroundColor: colors.surface }, active && { backgroundColor: colors.onSurface }]}><Text style={[styles.chipText, { color: colors.onSurface }, active && { color: colors.onSurfaceInverse }]}>{FILTER_LABEL[f]}</Text></Pressable>;
        }} />
      </View>

      {loading ? <View style={styles.centerFill}><ActivityIndicator color={colors.borderStrong} /></View> : error ? <View style={styles.centerFill}><View style={[styles.errorBanner, { borderColor: colors.error, backgroundColor: "#FFF0F0" }]}><Text style={[styles.errorText, { color: colors.error }]}>{error.toUpperCase()}</Text></View><Pressable onPress={load} style={[styles.retryBtn, { borderColor: colors.borderStrong }]}><Text style={[styles.retryText, { color: colors.onSurface }]}>RETRY</Text></Pressable></View> : sites.length === 0 ? <View style={styles.emptyWrap}><View style={[styles.emptyBox, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary }]}><Ionicons name="business-outline" size={48} color={colors.onSurface} /><Text style={[styles.emptyTitle, { color: colors.onSurface }]}>NO SITES IN THIS DISTRICT</Text><Text style={[styles.emptyBody, { color: colors.muted }]}>Tap the + button to add your first site in {districtName(key)}.</Text><Pressable onPress={() => router.push(`/(app)/add-site?district=${key}`)} style={[styles.emptyBtn, { backgroundColor: colors.brand }]}><Text style={[styles.emptyBtnText, { color: colors.onBrand }]}>ADD NEW SITE →</Text></Pressable></View></View> : <FlatList data={sites} keyExtractor={s => s.id} renderItem={renderItem} contentContainerStyle={{ paddingBottom: spacing.xxxl }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />} />}
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1 },
  header: { backgroundColor: colors.surface, borderBottomWidth: 2, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, gap: spacing.md },
  headerTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headerTitle: { fontSize: 24, fontWeight: "900", letterSpacing: -1 },
  headerSubtitle: { fontFamily: type.mono, fontSize: sizes.sm, marginTop: 2, letterSpacing: 1 },
  addBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  searchWrap: { flexDirection: "row", alignItems: "center", borderWidth: 2, paddingHorizontal: spacing.md, height: 52 },
  searchInput: { flex: 1, fontFamily: type.mono, fontSize: sizes.base, padding: 0 },
  chipsRow: { gap: spacing.sm, alignItems: "center", height: 40 },
  chip: { borderWidth: 2, paddingHorizontal: spacing.md, height: 36, justifyContent: "center", flexShrink: 0 },
  chipText: { fontFamily: type.mono, fontSize: sizes.sm, fontWeight: "800", letterSpacing: 1 },
  siteCard: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, borderBottomWidth: 2, gap: spacing.md },
  siteCardTop: { flexDirection: "row", alignItems: "flex-start" },
  siteName: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  plot: { fontFamily: type.mono, fontSize: sizes.sm, marginTop: 4, letterSpacing: 1 },
  locationText: { fontFamily: type.mono, fontSize: sizes.sm, marginTop: 2 },
  statusPill: { borderWidth: 2, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  statusPillText: { fontFamily: type.mono, fontSize: sizes.sm - 1, fontWeight: "900", letterSpacing: 1 },
  siteMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: spacing.sm },
  metaBox: { borderWidth: 2, paddingHorizontal: spacing.md, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  metaLabel: { fontFamily: type.mono, fontSize: sizes.sm - 1, letterSpacing: 1 },
  metaValue: { fontFamily: type.mono, fontSize: sizes.lg, fontWeight: "900" },
  metaArrow: { padding: spacing.sm },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  errorBanner: { borderWidth: 2, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  errorText: { fontFamily: type.mono, fontSize: sizes.sm },
  retryBtn: { borderWidth: 2, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  retryText: { fontFamily: type.mono, fontWeight: "800", letterSpacing: 1 },
  emptyWrap: { flex: 1, padding: spacing.xl, justifyContent: "center" },
  emptyBox: { borderWidth: 2, padding: spacing.xl, alignItems: "center", gap: spacing.md },
  emptyTitle: { fontSize: sizes.xxl, fontWeight: "900", letterSpacing: -0.5 },
  emptyBody: { fontFamily: type.mono, textAlign: "center" },
  emptyBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, marginTop: spacing.sm },
  emptyBtnText: { fontFamily: type.mono, fontWeight: "800", letterSpacing: 1 },
  statusCompleted: {
    borderWidth: 2,
  },

  statusActive: {
    borderWidth: 2,
  },

  statusCompletedText: {
    fontWeight: "900",
    letterSpacing: 1,
  },

  statusActiveText: {
    fontWeight: "900",
    letterSpacing: 1,
  },

});
