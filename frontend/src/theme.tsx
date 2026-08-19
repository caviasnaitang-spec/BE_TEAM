import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Palette = {
  surface: string; onSurface: string; surfaceSecondary: string; onSurfaceSecondary: string;
  surfaceTertiary: string; onSurfaceTertiary: string; surfaceInverse: string; onSurfaceInverse: string;
  brand: string; brandSecondary: string; onBrand: string; success: string; warning: string;
  error: string; onError: string; border: string; borderStrong: string; divider: string; muted: string;
};

const LIGHT: Palette = {
  surface: "#FFFFFF", onSurface: "#18181B", surfaceSecondary: "#F4F4F5", onSurfaceSecondary: "#18181B",
  surfaceTertiary: "#E4E4E7", onSurfaceTertiary: "#27272A", surfaceInverse: "#18181B", onSurfaceInverse: "#FFFFFF",
  brand: "#FF5500", brandSecondary: "#FFD600", onBrand: "#FFFFFF", success: "#00A35C", warning: "#FFD600",
  error: "#E60000", onError: "#FFFFFF", border: "#E4E4E7", borderStrong: "#18181B", divider: "#D4D4D8", muted: "#71717A",
};

const DARK: Palette = {
  surface: "#0B0B0F", onSurface: "#F4F4F5", surfaceSecondary: "#18181B", onSurfaceSecondary: "#F4F4F5",
  surfaceTertiary: "#27272A", onSurfaceTertiary: "#F4F4F5", surfaceInverse: "#F4F4F5", onSurfaceInverse: "#0B0B0F",
  brand: "#FF6A1F", brandSecondary: "#FFD600", onBrand: "#0B0B0F", success: "#22C55E", warning: "#FFD600",
  error: "#F87171", onError: "#0B0B0F", border: "#27272A", borderStrong: "#F4F4F5", divider: "#3F3F46", muted: "#A1A1AA",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const type = {
  ui: Platform.select({ ios: "System", android: "sans-serif", default: "System" }) as string,
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) as string,
};
export const sizes = { sm: 12, base: 14, lg: 16, xl: 20, xxl: 24, display: 32 };

export const colors: Palette = LIGHT; // legacy, use useTheme() instead

type ThemeMode = "light" | "dark";
type Ctx = { mode: ThemeMode; palette: Palette; toggle: () => void; set: (m: ThemeMode) => void };
const ThemeContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "fm:theme-mode";

export function ThemeProvider({ children }: React.PropsWithChildren) {
  const [mode, setMode] = useState<ThemeMode>("light");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(STORAGE_KEY);
        if (v === "dark" || v === "light") setMode(v);
      } catch {}
      setHydrated(true);
    })();
  }, []);
  const set = (m: ThemeMode) => { setMode(m); AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {}); };
  const toggle = () => set(mode === "light" ? "dark" : "light");
  const value = useMemo<Ctx>(() => ({ mode, palette: mode === "dark" ? DARK : LIGHT, toggle, set }), [mode]);
  if (!hydrated) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext);
  if (!ctx) return { mode: "light", palette: LIGHT, toggle: () => {}, set: () => {} };
  return ctx;
}
