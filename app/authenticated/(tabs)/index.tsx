import { useAuthContext } from "@/src/context/auth-context";
import CustomModal from "@/src/components/modal";
import { useOfflineContext, usePlantsView } from "@/src/context/offline-context";
import { useFindAllPlantsTypes } from "@/src/http/generated/plants-type/plants-type";
import { useFindMe } from "@/src/http/generated/user/user";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function HomeScreen() {
  const { data: user } = useFindMe();
  const { plants: plantsMerge } = usePlantsView();
  const { data: plantType } = useFindAllPlantsTypes();

  const { pendingCount, failedCount } = useOfflineContext();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const unsynced = pendingCount + failedCount;
  const { logout } = useAuthContext();

  const router = useRouter();

  const quickActions = [
    {
      icon: "add-circle",
      label: "Adicionar Planta",
      color: "bg-green-500",
      action: () => {
        router.push("/authenticated/add-plants");
      },
    },
    {
      icon: "map",
      label: "Ver Mapa",
      color: "bg-blue-500",
      action: () => router.push("/authenticated/(tabs)/plants-map"),
    },
  ];

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="bg-white px-6 py-4 shadow-sm">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Image
                source={
                  user?.avatarUrl
                    ? { uri: user.avatarUrl }
                    : require("@/assets/images/user-placeholder.png")
                }
                className="w-12 h-12 rounded-full mr-3"
              />
              <View>
                <Text className="text-gray-600 text-sm">Bom dia,</Text>
                <Text className="text-gray-900 text-lg font-semibold">
                  {user?.name}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => (unsynced > 0 ? setConfirmLogout(true) : logout())}
            >
              <View className="flex-row items-center mt-2">
                <AntDesign name="logout" size={24} color="black" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Care Reminders */}
        {/* <View className="px-6 py-4">
          <Text className="text-gray-900 text-xl font-bold mb-4">
            Lembretes de Cuidado
          </Text>
          <View className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <View className="flex-row items-center mb-2">
              <Ionicons name="water" size={20} color="#EA580C" />
              <Text className="text-orange-800 font-semibold ml-2">
                Rega necessária
              </Text>
            </View>
            <Text className="text-orange-700 text-sm">
              2 plantas precisam ser regadas hoje
            </Text>
            <TouchableOpacity className="mt-3">
              <Text className="text-orange-600 font-semibold">
                Ver detalhes
              </Text>
            </TouchableOpacity>
          </View>
        </View> */}

        {/* Stats Cards */}
        <View className="px-6 py-4">
          <Text className="text-gray-900 text-xl font-bold mb-4">
            Suas Plantas
          </Text>
          <View className="flex-row justify-between">
            <View className="bg-white rounded-xl p-4 flex-1 mr-2 shadow-sm">
              <Text className="text-2xl font-bold text-green-600">
                {plantsMerge.length}
              </Text>
              <Text className="text-gray-600 text-sm">Plantas cadastradas</Text>
            </View>
            <View className="bg-white rounded-xl p-4 flex-1 mx-1 shadow-sm">
              <Text className="text-2xl font-bold text-green-600">
                {unsynced}
              </Text>
              <Text className="text-gray-600 text-sm">
                Pendentes de sincronizar
              </Text>
            </View>
            {/* <View className="bg-white rounded-xl p-4 flex-1 ml-2 shadow-sm">
              <Text className="text-2xl font-bold text-orange-600">
                {stats.needsCare}
              </Text>
              <Text className="text-gray-600 text-sm">Precisam cuidados</Text>
            </View> */}
          </View>
        </View>

        {/* Quick Actions */}
        <View className="px-6 py-2">
          <Text className="text-gray-900 text-xl font-bold mb-4">
            Ações Rápidas
          </Text>
          <View className="flex-row gap-8">
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                onPress={action.action}
                className="items-center"
              >
                <View
                  className={`${action.color} w-16 h-16 rounded-2xl items-center justify-center mb-2 shadow-sm`}
                >
                  <Ionicons name={action.icon as any} size={24} color="white" />
                </View>
                <Text className="text-gray-700 text-xs text-center font-medium">
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="px-6 py-4">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-gray-900 text-xl font-bold">Plantas</Text>
            <TouchableOpacity
              onPress={() => {
                router.push("/authenticated/plants");
              }}
            >
              <Text className="text-green-600 font-medium">Ver todas</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            className="max-h-[400px]"
            showsVerticalScrollIndicator={false}
          >
            {[...plantsMerge]
              .sort((a, b) => {
                // Sort offline plants first
                if (a.offline && !b.offline) return -1;
                if (!a.offline && b.offline) return 1;
                return 0;
              })
              .slice(0, 10)
              .map((plant) => (
                <TouchableOpacity
                  key={plant.id}
                  className="bg-white rounded-xl p-4 mb-3 shadow-sm flex-row items-center"
                  onPress={() => {
                    router.push(`/authenticated/add-plants/${plant.id}`);
                  }}
                >
                  <Image
                    source={
                      plant.image
                        ? { uri: plant.image }
                        : plantType?.find((p) => p.id === plant.typeId)
                            ?.name === "Chacrona"
                        ? require("@/assets/images/plant.png")
                        : require("@/assets/images/vine.jpg")
                    }
                    className="w-16 h-16 rounded-xl mr-4"
                  />
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-1">
                      <Text className="text-gray-900 font-semibold text-base">
                        {plant.name}
                      </Text>
                      {plant.offline && (
                        <View className="bg-red-100 px-2 py-1 rounded-md">
                          <Text className="text-red-600 text-[0.525rem] font-medium">
                            OFFLINE
                          </Text>
                        </View>
                      )}
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Text className="text-gray-600 text-sm">
                        {plant.latitude}
                      </Text>
                      <Text className="text-gray-600 text-sm">
                        {plant.longitude}
                      </Text>
                    </View>
                    <Text className="text-gray-600 text-sm">
                      {plantType?.find((p) => p.id === plant.typeId)?.name}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
          </ScrollView>
        </View>
      </ScrollView>
      {confirmLogout && (
        <CustomModal
          visible={confirmLogout}
          icon="cloud-offline"
          iconColor="#EA580C"
          title="Dados não sincronizados"
          message={`${unsynced} alteraç${unsynced !== 1 ? "ões" : "ão"} ainda não ${unsynced !== 1 ? "foram enviadas" : "foi enviada"}. Elas continuam salvas neste aparelho e sobem quando você entrar de novo com esta conta.`}
          actions={[
            { text: "Cancelar", onPress: () => setConfirmLogout(false), style: "secondary" },
            {
              text: "Sair mesmo assim",
              style: "danger",
              onPress: () => {
                setConfirmLogout(false);
                logout();
              },
            },
          ]}
        />
      )}
    </View>
  );
}
