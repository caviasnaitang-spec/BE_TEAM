import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useSession } from "@/src/session";
import { useTheme, spacing, sizes, type } from "@/src/theme";

export default function LoginScreen() {
  const { palette: colors } = useTheme();
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!email || !password) { setError("EMAIL AND PASSWORD ARE REQUIRED"); return; }
    setBusy(true); setError("");
    try {
      await signIn(email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError((e?.message || "LOGIN FAILED").toUpperCase());
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.heroWrap} testID="login-hero">
            <Image source={{ uri: "https://images.unsplash.com/photo-1527335988388-b40ee248d80c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NjV8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlJTIwYnVpbGRpbmclMjBhcmNoaXRlY3R1cmV8ZW58MHx8fHwxNzg2MDg0NTE4fDA&ixlib=rb-4.1.0&q=85" }} style={styles.hero} contentFit="cover" />
            <View style={[styles.heroBadge, { backgroundColor: colors.brand }]}><Text style={[styles.heroBadgeText, { color: colors.onBrand }]}>FIELDMONITOR / V1</Text></View>
          </View>
          <View style={[styles.body, { backgroundColor: colors.surface }]}>
            <Text style={[styles.title, { color: colors.onSurface }]}>SIGN{"\n"}IN.</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>Access your assigned construction sites.</Text>
            {error ? <View style={[styles.errorBanner, { borderColor: colors.error, backgroundColor: "#FFF0F0" }]}><Text style={[styles.errorText, { color: colors.error }]}>{error}</Text></View> : null}
            <Text style={[styles.label, { color: colors.onSurface }]}>EMAIL</Text>
            <TextInput testID="login-email-input" value={email} onChangeText={setEmail} placeholder="engineer@site.co" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" style={[styles.input, { borderColor: colors.borderStrong, color: colors.onSurface, backgroundColor: colors.surface }]} />
            <Text style={[styles.label, { color: colors.onSurface }]}>PASSWORD</Text>
            <TextInput testID="login-password-input" value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={colors.muted} secureTextEntry style={[styles.input, { borderColor: colors.borderStrong, color: colors.onSurface, backgroundColor: colors.surface }]} />
            <Pressable testID="login-submit-button" onPress={onSubmit} disabled={busy} style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.brand }, pressed && { backgroundColor: "#CC4400" }, busy && { opacity: 0.6 }]}>
              {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={[styles.primaryBtnText, { color: colors.onBrand }]}>LOG IN →</Text>}
            </Pressable>
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: colors.muted }]}>NO ACCOUNT?</Text>
              <Link href="/signup" asChild><Pressable><Text style={[styles.footerLink, { color: colors.brand }]}>CREATE ONE</Text></Pressable></Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
  heroWrap: { height: 200, backgroundColor: "#18181B", position: "relative" },
  hero: { width: "100%", height: "100%", opacity: 0.7 },
  heroBadge: { position: "absolute", top: 16, left: 16, paddingHorizontal: 12, paddingVertical: 6 },
  heroBadgeText: { fontFamily: "monospace", fontSize: 12, letterSpacing: 1 },
  body: { padding: 24, gap: 12, flex: 1 },
  title: { fontSize: 48, lineHeight: 48, fontWeight: "900", letterSpacing: -1, marginTop: 12 },
  subtitle: { fontSize: 14, marginBottom: 12 },
  label: { fontFamily: "monospace", fontSize: 12, letterSpacing: 1, marginTop: 8 },
  input: { borderWidth: 2, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, fontFamily: "monospace", minHeight: 56 },
  primaryBtn: { marginTop: 16, paddingVertical: 18, alignItems: "center", justifyContent: "center", minHeight: 60 },
  primaryBtnText: { fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  errorBanner: { borderWidth: 2, paddingHorizontal: 16, paddingVertical: 8 },
  errorText: { fontFamily: "monospace", fontSize: 12 },
  footer: { marginTop: 24, flexDirection: "row", gap: 8, alignItems: "center" },
  footerText: { fontFamily: "monospace", fontSize: 12 },
  footerLink: { fontFamily: "monospace", fontSize: 12, fontWeight: "800" },
});
