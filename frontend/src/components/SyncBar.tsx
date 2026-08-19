import { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/src/session";
import { useTheme, spacing, sizes, type } from "@/src/theme";

export default function SyncBar() {
  const { palette: colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { online, pendingCount, syncNow } = useSession();

  if (online && pendingCount === 0) return null;

  const label = !online
    ? `OFFLINE${pendingCount ? ` · ${pendingCount} PENDING` : ""}`
    : `SYNCING · ${pendingCount} PENDING`;

  return (
    <View style={[styles.wrap, { backgroundColor: !online ? colors.onSurface : colors.brandSecondary }]}>
      <View style={styles.left}>
        <Ionicons name={!online ? "cloud-offline-outline" : "sync-outline"} size={16} color={!online ? colors.brandSecondary : colors.onSurface} />
        <Text style={[styles.text, { color: !online ? colors.brandSecondary : colors.onSurface }]}>{label}</Text>
      </View>
      {online && pendingCount > 0 ? (
        <Pressable onPress={syncNow} hitSlop={8} style={styles.retryBtn}>
          <Text style={styles.retryText}>SYNC NOW →</Text>
        </Pressable>
      ) : online ? <ActivityIndicator size="small" color={colors.onSurface} /> : null}
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: colors.borderStrong },
  left: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  text: { fontFamily: type.mono, fontSize: sizes.sm, letterSpacing: 1, fontWeight: "800" },
  retryBtn: { borderWidth: 2, borderColor: colors.onSurface, paddingHorizontal: 8, paddingVertical: 4 },
  retryText: { fontFamily: type.mono, fontSize: sizes.sm - 1, color: colors.onSurface, fontWeight: "900", letterSpacing: 1 },
});
