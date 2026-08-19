import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, type, sizes } from "@/src/theme";

export default function AppTabsLayout() {
  const { palette: colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopWidth: 2, borderTopColor: colors.borderStrong, height: 68, paddingTop: 8, paddingBottom: 10 },
        tabBarLabelStyle: { fontFamily: type.mono, fontSize: sizes.sm - 1, letterSpacing: 1, fontWeight: "700" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "BE IMPL.", tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="add-site" options={{ title: "ADD", tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "PROFILE", tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}
