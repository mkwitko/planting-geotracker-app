import { useAuthContext } from "@/src/context/auth-context";
import { Slot } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

export default function AuthenticatedLayout() {
  const { isReady } = useAuthContext();

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-100">
      <Slot />
    </View>
  );
}
