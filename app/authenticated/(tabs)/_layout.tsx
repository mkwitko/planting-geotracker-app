import { useAuthContext } from "@/src/context/auth-context";
import { Entypo } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TabsLayout() {
  const { isReady } = useAuthContext();

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-zinc-100">
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: "green",
          headerShown: false,
          tabBarStyle: {
            paddingBottom: 5,
            paddingTop: 5,
            height: 60, // Define uma altura fixa para a tab bar
          },
          tabBarItemStyle: {
            justifyContent: "center",
            alignItems: "center",
          },
          tabBarIconStyle: {
            marginBottom: 0, // Remove margem inferior padrão do ícone
          },
          tabBarLabelStyle: {
            marginTop: 2, // Pequeno espaço entre ícone e texto
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Início",
            tabBarIcon: ({ color }) => (
              <Entypo name="home" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="plants"
          options={{
            title: "Plantas",
            tabBarIcon: ({ color }) => (
              <Entypo name="tree" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="plants-map"
          options={{
            title: "Mapa",
            tabBarIcon: ({ color }) => (
              <Entypo name="map" size={24} color={color} />
            ),
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}
