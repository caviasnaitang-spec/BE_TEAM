import { useEffect, useState } from "react";
import * as Font from "expo-font";

export function useIconFonts() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<any>(null);
  useEffect(() => {
    (async () => {
      try {
        await Font.loadAsync({
          "Ionicons": require("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf"),
        });
        setLoaded(true);
      } catch (e) {
        setError(e);
      }
    })();
  }, []);
  return [loaded, error];
}
