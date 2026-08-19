import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, ActivityIndicator, View, StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { SessionProvider, useSession } from "@/src/session";
import { ThemeProvider, useTheme } from "@/src/theme";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

function AuthGate() {
  const { session, loading } = useSession();
  const { palette: colors, mode } = useTheme();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const inApp = segments[0] === "(app)";
    const inSiteRoute = segments[0] === "site";
    const inDistrictRoute = segments[0] === "district";
    if (!session && (inApp || inSiteRoute || inDistrictRoute)) {
      router.replace("/");
    } else if (session && !inApp && !inSiteRoute && !inDistrictRoute) {
      router.replace("/(app)");
    }
  }, [session, loading, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.borderStrong} />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle={mode === "dark" ? "light-content" : "dark-content"} backgroundColor={colors.surface} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="district/[key]" />
        <Stack.Screen name="site/[id]/index" />
        <Stack.Screen name="site/[id]/visit/[visitId]/index" />
        <Stack.Screen name="site/[id]/visit/[visitId]/camera" options={{ presentation: "fullScreenModal" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);
  if (!loaded && !error) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SessionProvider>
            <AuthGate />
          </SessionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
