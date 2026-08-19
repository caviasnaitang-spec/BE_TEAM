import { useCallback, useState, useMemo, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TextInput } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/src/session";
import { District, Site } from "@/src/api";
import { DISTRICTS } from "@/src/districts";
import { useTheme, spacing, sizes, type } from "@/src/theme";
import SyncBar from "@/src/components/SyncBar";

export default function DistrictsScreen() {
  const { palette: colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { api, online } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Site[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = search.trim();

    if (!q) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      if (!api) return;

      setSearching(true);

      try {
        const results = await api.listSites({ q });

        if (!cancelled) {
          setSearchResults(results);
        }
      } catch {
        if (!cancelled) {
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [api, search]);

  const load = useCallback(async () => {
    if (!api) return; setError("");
    try { const list = await api.listDistricts(); setItems(list); }
    catch (e: any) { setItems(DISTRICTS.map(d => ({ ...d, site_count: 0, active_count: 0, completed_count: 0 }))); setError(e?.message || "Failed to load districts"); }
    finally { setLoading(false); setRefreshing(false); }
  }, [api]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const totalSites = items.reduce((n, d) => n + d.site_count, 0);
  const activeSites = items.reduce((n, d) => n + d.active_count, 0);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top"]}>
      <SyncBar />
      <View style={[styles.header, { borderBottomColor: colors.borderStrong }]}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}><Text style={[styles.title, { color: colors.onSurface }]}>BE IMPLEMENTATION</Text><Text style={[styles.subtitle, { color: colors.muted }]}>MEGHALAYA · FIELD MONITORING</Text></View>
          <View style={[styles.stateChip, { borderColor: colors.borderStrong }]}>
            <View style={[styles.dot, { backgroundColor: online ? colors.success : colors.error }]} />
            <Text style={[styles.stateChipText, { color: colors.onSurface }]}>{online ? "ONLINE" : "OFFLINE"}</Text>
          </View>
        </View>
        <View style={[styles.summaryRow, { borderColor: colors.borderStrong }]}>
          <View style={[styles.summaryBox, { borderRightColor: colors.borderStrong }]}><Text style={[styles.summaryLabel, { color: colors.muted }]}>SITES</Text><Text style={[styles.summaryValue, { color: colors.onSurface }]}>{totalSites}</Text></View>
          <View style={[styles.summaryBox, { borderRightColor: colors.borderStrong }]}><Text style={[styles.summaryLabel, { color: colors.muted }]}>ONGOING</Text><Text style={[styles.summaryValue, { color: colors.brand }]}>{activeSites}</Text></View>
          <View style={[styles.summaryBox, { borderRightWidth: 0 }]}><Text style={[styles.summaryLabel, { color: colors.muted }]}>COMPLETE</Text><Text style={[styles.summaryValue, { color: colors.onSurface }]}>{totalSites - activeSites}</Text></View>
        </View>
      </View>

      <View style={[styles.searchWrap, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name="search" size={21} color={colors.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="SEARCH SITE, PLOT OR LOCATION"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.searchInput, { color: colors.onSurface }]}
        />
        {search ? (
          <Pressable onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={21} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {search.trim() ? (
        searching ? (
          <View style={styles.searchLoading}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : (
          <FlatList
            data={searchResults}
            keyExtractor={site => site.id}
            contentContainerStyle={{ paddingBottom: spacing.xxxl }}
            ListEmptyComponent={
              <View style={styles.noResults}>
                <Ionicons name="search-outline" size={40} color={colors.muted} />
                <Text style={[styles.noResultsTitle, { color: colors.onSurface }]}>NO SITES FOUND</Text>
                <Text style={[styles.noResultsText, { color: colors.muted }]}>Try a different site name, plot number or location.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const district = DISTRICTS.find(d => d.key === item.district)?.name || item.district;
              return (
                <Pressable
                  onPress={() => router.push(`/site/${item.id}`)}
                  style={({ pressed }) => [
                    styles.searchResult,
                    { borderBottomColor: colors.borderStrong },
                    pressed && { backgroundColor: colors.surfaceSecondary },
                  ]}
                >
                  <Ionicons name="location-outline" size={22} color={colors.brand} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.searchResultName, { color: colors.onSurface }]}>
                      {item.name.toUpperCase()}
                    </Text>
                    <Text style={[styles.searchResultMeta, { color: colors.muted }]}>
                      {district.toUpperCase()} · {item.plot_number}
                      {item.location ? ` · ${item.location}` : ""}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.onSurface} />
                </Pressable>
              );
            }}
          />
        )
      ) : loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={colors.borderStrong} />
        </View>
      ) : (
        <FlatList
          testID="districts-list"
          data={items}
          keyExtractor={d => d.key}
          contentContainerStyle={{ paddingBottom: spacing.xxxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          renderItem={({ item, index }) => (
            <Pressable onPress={() => router.push(`/district/${item.key}`)} style={({ pressed }) => [styles.districtRow, { borderBottomColor: colors.borderStrong }, pressed && { backgroundColor: colors.surfaceSecondary }]}>
              <View style={styles.districtLeft}>
                <Text style={[styles.districtNumber, { color: colors.brand }]}>{String(index + 1).padStart(2, "0")}</Text>
                <View style={{ flex: 1 }}><Text style={[styles.districtName, { color: colors.onSurface }]}>{item.name.toUpperCase()}</Text><Text style={[styles.districtMeta, { color: colors.muted }]}>{item.site_count} SITES · {item.active_count} ONGOING · {item.completed_count} COMPLETE</Text></View>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.onSurface} />
            </Pressable>
          )}
          ListFooterComponent={error ? <View style={styles.footerErr}><Text style={[styles.footerErrText, { color: colors.muted }]}>USING OFFLINE LIST · {error.toUpperCase()}</Text></View> : null}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { borderBottomWidth: 2, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, gap: spacing.md },
  headerTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  title: { fontSize: 28, fontWeight: "900", letterSpacing: -1 },
  subtitle: { fontFamily: type.mono, fontSize: sizes.sm, letterSpacing: 1, marginTop: 2 },
  stateChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 2, paddingHorizontal: 8, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 999 },
  stateChipText: { fontFamily: type.mono, fontSize: sizes.sm - 1, letterSpacing: 1, fontWeight: "900" },
  summaryRow: { flexDirection: "row", borderWidth: 2 },
  summaryBox: { flex: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRightWidth: 2 },
  summaryLabel: { fontFamily: type.mono, fontSize: sizes.sm - 1, letterSpacing: 1 },
  summaryValue: { fontFamily: type.mono, fontSize: sizes.xl, fontWeight: "900", marginTop: 2 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  districtRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, borderBottomWidth: 2, gap: spacing.md },
  districtLeft: { flex: 1, flexDirection: "row", gap: spacing.md, alignItems: "center" },
  districtNumber: { fontFamily: type.mono, fontSize: sizes.xl, fontWeight: "900", minWidth: 32 },
  districtName: { fontSize: 18, fontWeight: "900", letterSpacing: -0.5 },
  districtMeta: { fontFamily: type.mono, fontSize: sizes.sm, marginTop: 4, letterSpacing: 1 },
  searchWrap: { marginHorizontal: spacing.lg, marginTop: spacing.md, minHeight: 54, borderWidth: 2, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, gap: spacing.sm },
  searchInput: { flex: 1, minHeight: 50, fontFamily: type.mono, fontSize: sizes.sm, letterSpacing: 0.5 },
  searchLoading: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: spacing.xl },
  searchResult: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, borderBottomWidth: 2 },
  searchResultName: { fontSize: 17, fontWeight: "900" },
  searchResultMeta: { fontFamily: type.mono, fontSize: sizes.sm - 1, marginTop: 4, letterSpacing: 0.5 },
  noResults: { alignItems: "center", padding: spacing.xxxl, gap: spacing.sm },
  noResultsTitle: { fontWeight: "900", fontSize: sizes.lg },
  noResultsText: { fontFamily: type.mono, fontSize: sizes.sm, textAlign: "center" },
  footerErr: { padding: spacing.md, alignItems: "center" },
  footerErrText: { fontFamily: type.mono, fontSize: sizes.sm - 1, letterSpacing: 1 },
});
