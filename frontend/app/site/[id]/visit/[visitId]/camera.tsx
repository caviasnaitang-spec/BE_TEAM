import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Platform, Image as RNImage } from "react-native";
import { Image } from "expo-image";
import { CameraView, useCameraPermissions, CameraType } from "expo-camera";
import * as Location from "expo-location";
import ViewShot, { captureRef } from "react-native-view-shot";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSession } from "@/src/session";
import { useTheme, spacing, sizes, type } from "@/src/theme";

type LocationSnapshot = { latitude: number; longitude: number; accuracy: number | null; timestamp: number; };

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function formatDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function formatTime(d: Date) { return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
function formatCoord(n: number | undefined | null) { if (n === undefined || n === null || Number.isNaN(n)) return "--.------"; return n.toFixed(6); }

export default function CameraScreen() {
  const { palette: colors } = useTheme();
  const { id: siteId, visitId } = useLocalSearchParams<{ id: string; visitId: string }>();
  const { api } = useSession();
  const router = useRouter();

  const [cameraPerm, requestCameraPerm] = useCameraPermissions();
  const [locStatus, setLocStatus] = useState<"pending" | "granted" | "denied">("pending");
  const [location, setLocation] = useState<LocationSnapshot | null>(null);
  const [facing, setFacing] = useState<CameraType>("back");
  const [now, setNow] = useState<Date>(new Date());
  const [busy, setBusy] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null);
  const [capturedImageLoaded, setCapturedImageLoaded] = useState(false);
  const [error, setError] = useState("");

  const cameraRef = useRef<CameraView>(null);
  const composeRef = useRef<ViewShot>(null);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { (async () => { if (!cameraPerm) return; if (!cameraPerm.granted && cameraPerm.canAskAgain) await requestCameraPerm(); })(); }, [cameraPerm, requestCameraPerm]);
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLocStatus("denied"); return; }
      setLocStatus("granted");
      try { const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }); setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null, timestamp: pos.timestamp }); } catch {}
      const sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 1, timeInterval: 2000 }, (pos) => { setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null, timestamp: pos.timestamp }); });
      return () => sub.remove();
    })();
  }, []);

  const captureAndCompose = useCallback(async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    setError("");
    setCapturedImageLoaded(false);
    setCapturedImageLoaded(false);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: false,
        ...(Platform.OS === "web" ? { base64: true } : {}),
      });

      if (!photo?.uri) throw new Error("Camera returned no image");

      if (Platform.OS === "web") {
        if (!photo.base64) throw new Error("Camera did not return image data");
        setCapturedBase64(photo.base64);
      }

      setCapturedUri(photo.uri);
    } catch (e: any) {
      setError(e?.message || "Capture failed");
      setBusy(false);
    }
  }, [busy]);

  const finalizeUpload = useCallback(async () => {
    if (!api || !visitId || !capturedUri) return;

    try {
      let base64: string;

      if (Platform.OS === "web") {
        // Browser camera already provides base64.
        // Do NOT use react-native-view-shot/captureRef on web.
        if (!capturedBase64) throw new Error("Captured image data is missing");
        base64 = capturedBase64;
      } else {
        if (!composeRef.current) throw new Error("Photo composition view is unavailable");

        const uri = await captureRef(composeRef, {
          format: "jpg",
          quality: 0.85,
          result: "tmpfile",
        });

        // Resize/compress the final geotagged image before converting
        // it to Base64. This prevents very large image payloads that
        // can fail to render reliably on iPhone/Android.
        const processed = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 1600 } }],
          {
            compress: 0.78,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );

        base64 = await FileSystem.readAsStringAsync(processed.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (!base64 || base64.length < 1000) {
          throw new Error("Captured image data is invalid or empty");
        }
      }

      const capturedAt = new Date().toISOString();

      await api.addPhoto(visitId, {
        image_base64: base64,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        accuracy: location?.accuracy ?? null,
        captured_at: capturedAt,
      }, siteId);

      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      ).catch(() => {});

      router.back();
    } catch (e: any) {
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error
      ).catch(() => {});

      setError(e?.message || "Upload failed");
      setBusy(false);
      setCapturedUri(null);
      setCapturedBase64(null);
      setCapturedImageLoaded(false);
      setCapturedImageLoaded(false);
    }
  }, [api, visitId, siteId, capturedUri, capturedBase64, location, router]);

  useEffect(() => {
    if (!capturedUri || !capturedImageLoaded) return;

    const t = setTimeout(() => {
      finalizeUpload();
    }, 100);

    return () => clearTimeout(t);
  }, [capturedUri, capturedImageLoaded, finalizeUpload]);

  if (!cameraPerm) return <View style={styles.blackFill}><ActivityIndicator color="#fff" /></View>;
  if (!cameraPerm.granted) return <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]}><View style={styles.permWrap}><Ionicons name="camera-outline" size={48} color={colors.onSurface} /><Text style={[styles.permTitle, { color: colors.onSurface }]}>CAMERA PERMISSION REQUIRED</Text><Text style={[styles.permBody, { color: colors.muted }]}>We need camera access to capture site photos.</Text><Pressable style={[styles.permBtn, { backgroundColor: colors.brand }]} onPress={() => requestCameraPerm()}><Text style={[styles.permBtnText, { color: colors.onBrand }]}>GRANT ACCESS</Text></Pressable><Pressable style={[styles.permBtnGhost, { borderColor: colors.borderStrong }]} onPress={() => router.back()}><Text style={[styles.permBtnGhostText, { color: colors.onSurface }]}>CANCEL</Text></Pressable></View></SafeAreaView>;

  const dateStr = formatDate(now), timeStr = formatTime(now);
  const gpsStr = locStatus === "denied" ? "GPS PERMISSION DENIED" : !location ? "GPS · SEARCHING…" : `LAT ${formatCoord(location.latitude)}  LON ${formatCoord(location.longitude)}${location.accuracy ? `  ±${Math.round(location.accuracy)}M` : ""}`;

  return (
    <View style={styles.root}>
      {!capturedUri && <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} />}
      {capturedUri && <ViewShot ref={composeRef} style={StyleSheet.absoluteFill} options={{ format: "jpg", quality: 0.85 }}><RNImage
            source={{ uri: capturedUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onLoad={() => setCapturedImageLoaded(true)}
            onError={() => {
              setError("Unable to load captured image");
              setBusy(false);
            }}
          /><OverlayHUD dateStr={dateStr} timeStr={timeStr} gpsStr={gpsStr} colors={colors} /></ViewShot>}
      {!capturedUri && <OverlayHUD dateStr={dateStr} timeStr={timeStr} gpsStr={gpsStr} colors={colors} />}

      <SafeAreaView pointerEvents="box-none" style={styles.topBarWrap} edges={["top"]}>
        <View style={styles.topBar} pointerEvents="box-none">
          <Pressable onPress={() => router.back()} style={styles.topBtn} hitSlop={12}><Ionicons name="close" size={22} color="#fff" /></Pressable>
          <View style={[styles.topBadge, { backgroundColor: "rgba(0,0,0,0.75)" }]}>
            <View style={[styles.dot, { backgroundColor: locStatus === "granted" && location ? colors.brandSecondary : colors.error }]} />
            <Text style={[styles.topBadgeText, { color: "#fff" }]}>{locStatus === "granted" && location ? "GPS LOCKED" : "GPS PENDING"}</Text>
          </View>
          <Pressable onPress={() => setFacing(f => f === "back" ? "front" : "back")} style={styles.topBtn} hitSlop={12}><Ionicons name="camera-reverse" size={22} color="#fff" /></Pressable>
        </View>
      </SafeAreaView>

      <SafeAreaView pointerEvents="box-none" style={styles.bottomBarWrap} edges={["bottom"]}>
        <View style={styles.bottomBar} pointerEvents="box-none">
          {error ? <View style={[styles.errorPill, { borderColor: colors.error, backgroundColor: "rgba(0,0,0,0.75)" }]}><Text style={[styles.errorPillText, { color: colors.error }]}>{error.toUpperCase()}</Text></View> : null}
          <Pressable onPress={captureAndCompose} disabled={busy} style={({ pressed }) => [styles.shutter, { borderColor: "#fff" }, pressed && { opacity: 0.7 }, busy && { opacity: 0.4 }]}>
            {busy ? <ActivityIndicator color={colors.onSurface} /> : <View style={[styles.shutterInner, { backgroundColor: colors.brand }]} />}
          </Pressable>
          <Text style={[styles.shutterLabel, { color: "#fff" }]}>{busy ? "PROCESSING…" : "TAP TO CAPTURE"}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

function OverlayHUD({ dateStr, timeStr, gpsStr, colors }: any) {
  return (
    <View pointerEvents="none" style={styles.hud}>
      <View style={styles.hudTop}><View style={[styles.hudChip, { borderLeftColor: colors.brand, backgroundColor: "rgba(0,0,0,0.8)" }]}><Text style={[styles.hudChipLabel, { color: "#fff" }]}>FIELDMONITOR</Text></View></View>
      <View style={[styles.hudBottom, { backgroundColor: "rgba(0,0,0,0.72)", borderLeftColor: colors.brandSecondary }]}>
        <View style={styles.hudLine}><Text style={[styles.hudLabel, { color: "#a1a1aa" }]}>DATE</Text><Text style={[styles.hudValue, { color: "#fff" }]}>{dateStr}</Text><Text style={[styles.hudLabel, { color: "#a1a1aa" }]}> TIME</Text><Text style={[styles.hudValue, { color: "#fff" }]}>{timeStr}</Text></View>
        <View style={styles.hudLine}><Text style={[styles.hudValue, { color: colors.brandSecondary }]} numberOfLines={2}>{gpsStr}</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  safe: { flex: 1 },
  blackFill: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
  topBarWrap: { position: "absolute", top: 0, left: 0, right: 0 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md },
  topBtn: { width: 44, height: 44, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },
  topBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  topBadgeText: { fontFamily: type.mono, fontSize: sizes.sm - 1, letterSpacing: 1, fontWeight: "800" },
  dot: { width: 8, height: 8, borderRadius: 999 },
  bottomBarWrap: { position: "absolute", bottom: 0, left: 0, right: 0 },
  bottomBar: { alignItems: "center", paddingVertical: spacing.lg, gap: spacing.sm },
  shutter: { width: 84, height: 84, borderRadius: 999, borderWidth: 4, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)" },
  shutterInner: { width: 64, height: 64, borderRadius: 999 },
  shutterLabel: { fontFamily: type.mono, letterSpacing: 2, fontSize: sizes.sm, fontWeight: "800" },
  errorPill: { borderWidth: 2, paddingHorizontal: spacing.md, paddingVertical: 6 },
  errorPillText: { fontFamily: type.mono, fontSize: sizes.sm, letterSpacing: 1 },
  hud: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "space-between", paddingTop: Platform.select({ ios: 100, android: 80, default: 100 }), paddingBottom: Platform.select({ ios: 200, android: 180, default: 200 }), paddingHorizontal: 12 },
  hudTop: { flexDirection: "row", justifyContent: "flex-end" },
  hudChip: { borderLeftWidth: 3, paddingHorizontal: 8, paddingVertical: 4 },
  hudChipLabel: { fontFamily: type.mono, fontSize: 11, letterSpacing: 2, fontWeight: "800" },
  hudBottom: { padding: 10, gap: 4, borderLeftWidth: 3 },
  hudLine: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4 },
  hudLabel: { fontFamily: type.mono, fontSize: 11, letterSpacing: 1 },
  hudValue: { fontFamily: type.mono, fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  permWrap: { flex: 1, padding: spacing.xl, justifyContent: "center", alignItems: "center", gap: spacing.md },
  permTitle: { fontSize: sizes.lg, fontWeight: "900", letterSpacing: 1, textAlign: "center" },
  permBody: { fontFamily: type.mono, fontSize: sizes.sm, textAlign: "center" },
  permBtn: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, minHeight: 56, justifyContent: "center" },
  permBtnText: { fontFamily: type.mono, fontWeight: "900", letterSpacing: 1 },
  permBtnGhost: { borderWidth: 2, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, minHeight: 56, justifyContent: "center" },
  permBtnGhostText: { fontFamily: type.mono, fontWeight: "800", letterSpacing: 1 },
});
