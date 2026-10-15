import { Slot } from "expo-router";
import React from "react";
import "./../global.css";

import { Providers } from "@/src/lib/provider";
import { StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  return (
    <GestureHandlerRootView
      style={{
        flex: 1,
      }}
    >
      <StatusBar barStyle="dark-content" />
      <Providers>
        <Slot />
      </Providers>
    </GestureHandlerRootView>
  );
}
