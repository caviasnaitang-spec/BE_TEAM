import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSession } from "@/src/session";
import { useTheme, spacing, sizes, type } from "@/src/theme";

export default function GalleryUploadScreen() {
  const { palette: colors } = useTheme();
  const { siteId, visitId } = {
    siteId: useLocalSearchParams<{ id: string }>().id,
    visitId: useLocalSearchParams<{ visitId: string }>().visitId,
  };

  const { api } = useSession();
  const router = useRouter();

  const [assets, setAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  const pickPhotos = useCallback(async () => {
    setError("");

    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError("PHOTO LIBRARY PERMISSION IS REQUIRED");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 20,
      allowsEditing: false,
      quality: 0.7,
      base64: true,
      exif: true,
    });

    if (!result.canceled) {
      setAssets(result.assets);
    }
  }, []);

  const removePhoto = (index: number) => {
    setAssets(current => current.filter((_, i) => i !== index));
  };

  const uploadPhotos = useCallback(async () => {
    if (!api || !visitId || assets.length === 0 || busy) return;

    setBusy(true);
    setError("");

    try {
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];

        setProgress(`UPLOADING ${i + 1} OF ${assets.length}`);

        if (!asset.base64) {
          throw new Error(
            `PHOTO ${i + 1} HAS NO IMAGE DATA. PLEASE SELECT IT AGAIN.`
          );
        }

        const exif: any = asset.exif || {};

        let latitude =
          typeof exif.GPSLatitude === "number"
            ? exif.GPSLatitude
            : null;

        let longitude =
          typeof exif.GPSLongitude === "number"
            ? exif.GPSLongitude
            : null;

        if (latitude !== null && exif.GPSLatitudeRef === "S") {
          latitude = -Math.abs(latitude);
        }

        if (longitude !== null && exif.GPSLongitudeRef === "W") {
          longitude = -Math.abs(longitude);
        }

        await api.addPhoto(visitId, {
          image_base64: asset.base64,
          latitude,
          longitude,
          accuracy: null,
          captured_at: new Date().toISOString(),
        });
      }

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      ).catch(() => {});

      router.back();
    } catch (e: any) {
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error
      ).catch(() => {});

      setError(e?.message || "UPLOAD FAILED");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }, [api, visitId, assets, busy, router]);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.surface }]}
      edges={["top", "bottom"]}
    >
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.borderStrong },
        ]}
      >
        <Pressable
          hitSlop={12}
          onPress={() => router.back()}
          disabled={busy}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={colors.onSurface}
          />
        </Pressable>

        <Text
          style={[
            styles.headerTitle,
            { color: colors.onSurface },
          ]}
        >
          UPLOAD PHOTOS
        </Text>

        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View
          style={[
            styles.infoCard,
            {
              borderColor: colors.borderStrong,
              backgroundColor: colors.surfaceSecondary,
            },
          ]}
        >
          <Ionicons
            name="images-outline"
            size={30}
            color={colors.brand}
          />

          <Text
            style={[
              styles.infoTitle,
              { color: colors.onSurface },
            ]}
          >
            ADD PHOTOS FROM YOUR PHONE
          </Text>

          <Text
            style={[
              styles.infoBody,
              { color: colors.muted },
            ]}
          >
            Upload photos from your phone when you completed
            a site visit but did not capture the photos directly
            in FieldMonitor.
          </Text>
        </View>

        <Pressable
          onPress={pickPhotos}
          disabled={busy}
          style={({ pressed }) => [
            styles.pickButton,
            { backgroundColor: colors.brand },
            pressed && { opacity: 0.75 },
            busy && { opacity: 0.5 },
          ]}
        >
          <Ionicons
            name="images"
            size={22}
            color={colors.onBrand}
          />

          <Text
            style={[
              styles.pickButtonText,
              { color: colors.onBrand },
            ]}
          >
            CHOOSE FROM GALLERY
          </Text>
        </Pressable>

        {assets.length > 0 && (
          <>
            <View style={styles.selectionHeader}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: colors.onSurface },
                ]}
              >
                SELECTED PHOTOS
              </Text>

              <Text
                style={[
                  styles.sectionCount,
                  { color: colors.muted },
                ]}
              >
                {assets.length} / 20
              </Text>
            </View>

            <View style={styles.grid}>
              {assets.map((asset, index) => (
                <View
                  key={`${asset.assetId || asset.uri}-${index}`}
                  style={styles.tile}
                >
                  <Image
                    source={{ uri: asset.uri }}
                    style={styles.image}
                    contentFit="cover"
                  />

                  <Pressable
                    onPress={() => removePhoto(index)}
                    disabled={busy}
                    style={styles.removeButton}
                  >
                    <Ionicons
                      name="close"
                      size={18}
                      color="#fff"
                    />
                  </Pressable>

                  <View
                    style={[
                      styles.numberBadge,
                      { backgroundColor: colors.brand },
                    ]}
                  >
                    <Text style={styles.numberText}>
                      {index + 1}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {error ? (
          <View
            style={[
              styles.errorBox,
              { borderColor: colors.error },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={20}
              color={colors.error}
            />

            <Text
              style={[
                styles.errorText,
                { color: colors.error },
              ]}
            >
              {error.toUpperCase()}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            borderTopColor: colors.borderStrong,
            backgroundColor: colors.surface,
          },
        ]}
      >
        {busy ? (
          <View style={styles.progress}>
            <ActivityIndicator color={colors.brand} />

            <Text
              style={[
                styles.progressText,
                { color: colors.onSurface },
              ]}
            >
              {progress}
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={uploadPhotos}
            disabled={assets.length === 0}
            style={[
              styles.uploadButton,
              {
                backgroundColor:
                  assets.length > 0
                    ? colors.brand
                    : colors.muted,
              },
            ]}
          >
            <Ionicons
              name="cloud-upload-outline"
              size={22}
              color={colors.onBrand}
            />

            <Text
              style={[
                styles.uploadButtonText,
                { color: colors.onBrand },
              ]}
            >
              UPLOAD {assets.length || ""} PHOTO
              {assets.length === 1 ? "" : "S"} →
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
  },

  headerTitle: {
    fontFamily: type.mono,
    fontSize: sizes.sm,
    fontWeight: "900",
    letterSpacing: 2,
  },

  body: {
    padding: spacing.lg,
    paddingBottom: 120,
    gap: spacing.md,
  },

  infoCard: {
    borderWidth: 2,
    padding: spacing.lg,
    gap: spacing.sm,
  },

  infoTitle: {
    fontSize: sizes.lg,
    fontWeight: "900",
  },

  infoBody: {
    fontFamily: type.mono,
    fontSize: sizes.sm,
    lineHeight: 18,
  },

  pickButton: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },

  pickButtonText: {
    fontFamily: type.mono,
    fontWeight: "900",
    letterSpacing: 1,
  },

  selectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },

  sectionTitle: {
    fontWeight: "900",
    letterSpacing: 1,
  },

  sectionCount: {
    fontFamily: type.mono,
    fontSize: sizes.sm,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },

  tile: {
    width: "31.8%",
    aspectRatio: 1,
    position: "relative",
    backgroundColor: "#ddd",
  },

  image: {
    width: "100%",
    height: "100%",
  },

  removeButton: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },

  numberBadge: {
    position: "absolute",
    bottom: 5,
    left: 5,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },

  numberText: {
    color: "#fff",
    fontFamily: type.mono,
    fontWeight: "900",
    fontSize: 11,
  },

  errorBox: {
    borderWidth: 2,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },

  errorText: {
    flex: 1,
    fontFamily: type.mono,
    fontSize: sizes.sm,
    fontWeight: "800",
  },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    borderTopWidth: 2,
  },

  uploadButton: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },

  uploadButtonText: {
    fontFamily: type.mono,
    fontWeight: "900",
    letterSpacing: 1,
  },

  progress: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },

  progressText: {
    fontFamily: type.mono,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
