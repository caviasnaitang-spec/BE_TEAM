import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/src/session";
import { useTheme, spacing, sizes, type } from "@/src/theme";

export default function AdminUsersScreen() {
  const { palette: colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session, api } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");

  const loadUsers = useCallback(async () => {
    if (!api || !session?.user?.is_admin) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await api.adminUsers();
      setUsers(result || []);
    } catch (e: any) {
      console.log("ADMIN USERS ERROR:", e);
      Alert.alert("Error", e?.message || "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, [api, session]);

  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [loadUsers])
  );

  const approveUser = async (id: string) => {
    if (!api) return;

    try {
      setWorking(id);
      await api.adminApproveUser(id);
      await loadUsers();
      Alert.alert("Approved", "The user can now log in.");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not approve user.");
    } finally {
      setWorking("");
    }
  };

  const rejectUser = async (id: string) => {
    if (!api) return;

    Alert.alert(
      "Reject user?",
      "This user will not be allowed to access the app.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              setWorking(id);
              await api.adminRejectUser(id);
              await loadUsers();
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Could not reject user.");
            } finally {
              setWorking("");
            }
          },
        },
      ]
    );
  };

  if (!session?.user?.is_admin) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.surface }]}
      >
        <View style={styles.center}>
          <Ionicons
            name="lock-closed-outline"
            size={48}
            color={colors.error}
          />
          <Text style={[styles.title, { color: colors.onSurface }]}>
            ACCESS DENIED
          </Text>

          <Pressable
            onPress={() => router.replace("/")}
            style={[styles.backButton, { borderColor: colors.borderStrong }]}
          >
            <Text style={[styles.backText, { color: colors.onSurface }]}>
              GO HOME
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.surface }]}
      edges={["top"]}
    >
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.borderStrong },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={colors.onSurface}
          />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.headerTitle,
              { color: colors.onSurface },
            ]}
          >
            USER APPROVALS
          </Text>

          <Text
            style={[
              styles.headerSub,
              { color: colors.muted },
            ]}
          >
            REGISTRATION CONTROL
          </Text>
        </View>

        <Pressable
          onPress={loadUsers}
          hitSlop={12}
        >
          <Ionicons
            name="refresh"
            size={23}
            color={colors.onSurface}
          />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingBottom: spacing.xxxl,
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons
                name="people-outline"
                size={48}
                color={colors.muted}
              />

              <Text
                style={[
                  styles.title,
                  { color: colors.onSurface },
                ]}
              >
                NO USERS
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const pending = item.status === "pending";
            const approved = item.status === "approved";

            return (
              <View
                style={[
                  styles.userCard,
                  { borderColor: colors.borderStrong },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: pending
                        ? colors.brand
                        : approved
                        ? colors.success
                        : colors.error,
                    },
                  ]}
                />

                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.userName,
                      { color: colors.onSurface },
                    ]}
                  >
                    {item.name || "Unnamed user"}
                  </Text>

                  <Text
                    style={[
                      styles.userEmail,
                      { color: colors.muted },
                    ]}
                  >
                    {item.email}
                  </Text>

                  <Text
                    style={[
                      styles.status,
                      {
                        color: pending
                          ? colors.brand
                          : approved
                          ? colors.success
                          : colors.error,
                      },
                    ]}
                  >
                    {item.status.toUpperCase()}
                  </Text>
                </View>

                {item.is_admin ? (
                  <View
                    style={[
                      styles.adminBadge,
                      { borderColor: colors.borderStrong },
                    ]}
                  >
                    <Text
                      style={[
                        styles.adminText,
                        { color: colors.onSurface },
                      ]}
                    >
                      ADMIN
                    </Text>
                  </View>
                ) : pending ? (
                  <View style={styles.actions}>
                    <Pressable
                      disabled={!!working}
                      onPress={() => approveUser(item.id)}
                      style={[
                        styles.approveButton,
                        { backgroundColor: colors.brand },
                      ]}
                    >
                      {working === item.id ? (
                        <ActivityIndicator
                          color={colors.onBrand}
                        />
                      ) : (
                        <Ionicons
                          name="checkmark"
                          size={22}
                          color={colors.onBrand}
                        />
                      )}
                    </Pressable>

                    <Pressable
                      disabled={!!working}
                      onPress={() => rejectUser(item.id)}
                      style={[
                        styles.rejectButton,
                        { borderColor: colors.error },
                      ]}
                    >
                      <Ionicons
                        name="close"
                        size={22}
                        color={colors.error}
                      />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    safe: {
      flex: 1,
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 2,
    },

    headerTitle: {
      fontSize: 22,
      fontWeight: "900",
    },

    headerSub: {
      fontFamily: type.mono,
      fontSize: sizes.sm - 1,
      letterSpacing: 1,
      marginTop: 2,
    },

    userCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderBottomWidth: 2,
    },

    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },

    userName: {
      fontSize: 17,
      fontWeight: "900",
    },

    userEmail: {
      fontFamily: type.mono,
      fontSize: sizes.sm,
      marginTop: 3,
    },

    status: {
      fontFamily: type.mono,
      fontSize: sizes.sm - 1,
      fontWeight: "900",
      marginTop: 6,
      letterSpacing: 1,
    },

    actions: {
      flexDirection: "row",
      gap: spacing.sm,
    },

    approveButton: {
      width: 46,
      height: 46,
      alignItems: "center",
      justifyContent: "center",
    },

    rejectButton: {
      width: 46,
      height: 46,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },

    adminBadge: {
      borderWidth: 2,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },

    adminText: {
      fontFamily: type.mono,
      fontSize: sizes.sm - 1,
      fontWeight: "900",
    },

    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.md,
      padding: spacing.xl,
    },

    title: {
      fontSize: 22,
      fontWeight: "900",
    },

    backButton: {
      borderWidth: 2,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },

    backText: {
      fontFamily: type.mono,
      fontWeight: "900",
      letterSpacing: 1,
    },
  });
