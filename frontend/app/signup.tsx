import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useSession } from "@/src/session";
import { useTheme, spacing, sizes, type } from "@/src/theme";

export default function SignupScreen() {
  const { palette: colors } = useTheme();
  const { signUp } = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!email || !password) { setError("EMAIL AND PASSWORD ARE REQUIRED"); return; }
    if (password.length < 6) { setError("PASSWORD MUST BE AT LEAST 6 CHARACTERS"); return; }
    setBusy(true); setError("");
    try { await signUp(email.trim(), password, name.trim() || undefined); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); }
    catch (e: any) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); setError((e?.message || "SIGN UP FAILED").toUpperCase()); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.header, { backgroundColor: colors.surface }]}>
            <Pressable onPress={() => router.back()}><Text style={[styles.backText, { color: colors.onSurface }]}>← BACK</Text></Pressable>
          </View>
          <View style={[styles.body, { backgroundColor: colors.surface }]}>
            <Text style={[styles.title, { color: colors.onSurface }]}>CREATE{"\n"}ACCOUNT.</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>4 users only — engineer credentials.</Text>
            {error ? <View style={[styles.errorBanner, { borderColor: colors.error, backgroundColor: "#FFF0F0" }]}><Text style={[styles.errorText, { color: colors.error }]}>{error}</Text></View> : null}
            <Text style={[styles.label, { color: colors.onSurface }]}>NAME (OPTIONAL)</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={colors.muted} autoCapitalize="words" style={[styles.input, { borderColor: colors.borderStrong, color: colors.onSurface, backgroundColor: colors.surface }]} />
            <Text style={[styles.label, { color: colors.onSurface }]}>EMAIL</Text>
            <TextInput value={email} onChangeText={setEmail} placeholder="engineer@site.co" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" style={[styles.input, { borderColor: colors.borderStrong, color: colors.onSurface, backgroundColor: colors.surface }]} />
            <Text style={[styles.label, { color: colors.onSurface }]}>PASSWORD</Text>
            <TextInput value={password} onChangeText={setPassword} placeholder="Min 6 characters" placeholderTextColor={colors.muted} secureTextEntry style={[styles.input, { borderColor: colors.borderStrong, color: colors.onSurface, backgroundColor: colors.surface }]} />
            <Pressable onPress={onSubmit} disabled={busy} style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.brand }, pressed && { backgroundColor: "#CC4400" }, busy && { opacity: 0.6 }]}>
              {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={[styles.primaryBtnText, { color: colors.onBrand }]}>CREATE ACCOUNT →</Text>}
            </Pressable>
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: colors.muted }]}>ALREADY REGISTERED?</Text>
              <Link href="/" asChild><Pressable><Text style={[styles.footerLink, { color: colors.brand }]}>LOG IN</Text></Pressable></Link>
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
  header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 },
  backText: { fontFamily: "monospace", fontSize: 12, letterSpacing: 1, fontWeight: "800" },
  body: { padding: 24, gap: 12 },
  title: { fontSize: 44, lineHeight: 46, fontWeight: "900", letterSpacing: -1 },
  subtitle: { fontSize: 14, marginBottom: 12 },
  label: { fontFamily: "monospace", fontSize: 12, letterSpacing: 1, marginTop: 8 },
  input: { borderWidth: 2, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, fontFamily: "monospace", minHeight: 56 },
  primaryBtn: { marginTop: 16, paddingVertical: 18, alignItems: "center", minHeight: 60 },
  primaryBtnText: { fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  errorBanner: { borderWidth: 2, paddingHorizontal: 16, paddingVertical: 8 },
  errorText: { fontFamily: "monospace", fontSize: 12 },
  footer: { marginTop: 24, flexDirection: "row", gap: 8, alignItems: "center" },
  footerText: { fontFamily: "monospace", fontSize: 12 },
  footerLink: { fontFamily: "monospace", fontSize: 12, fontWeight: "800" },
});
