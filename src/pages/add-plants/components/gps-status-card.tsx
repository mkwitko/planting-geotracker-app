import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { GpsStatus } from "../hooks/use-gps-capture";

interface GpsStatusCardProps {
  status: GpsStatus;
  accuracy: number | null;
  sampleCount: number;
  requiredSamples: number;
  isManual: boolean;
}

const accuracyLabel = (accuracy: number | null) =>
  accuracy !== null ? `±${accuracy.toFixed(1)}m` : "";

export const GpsStatusCard: React.FC<GpsStatusCardProps> = ({
  status,
  accuracy,
  sampleCount,
  requiredSamples,
  isManual,
}) => {
  if (isManual) {
    return (
      <View className="flex-row items-center justify-center gap-2 bg-blue-50 rounded-xl px-4 py-3 border border-blue-200">
        <Ionicons name="hand-left" size={18} color="#2563EB" />
        <Text className="text-blue-700 font-semibold">
          Posição ajustada manualmente
        </Text>
      </View>
    );
  }

  if (status === "denied") {
    return (
      <View className="flex-row items-center justify-center gap-2 bg-red-50 rounded-xl px-4 py-3 border border-red-200">
        <Ionicons name="alert-circle" size={18} color="#DC2626" />
        <Text className="text-red-700 font-semibold text-center">
          Permissão de localização negada. Habilite nas configurações.
        </Text>
      </View>
    );
  }

  if (status === "acquiring") {
    return (
      <View className="flex-row items-center justify-center gap-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
        <ActivityIndicator size="small" color="#16A34A" />
        <Text className="text-gray-700 font-semibold">
          Adquirindo sinal… ({sampleCount}/{requiredSamples}){" "}
          {accuracyLabel(accuracy)}
        </Text>
      </View>
    );
  }

  if (status === "precise") {
    return (
      <View className="flex-row items-center justify-center gap-2 bg-green-50 rounded-xl px-4 py-3 border border-green-200">
        <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
        <Text className="text-green-700 font-semibold">
          Precisão ótima {accuracyLabel(accuracy)}
        </Text>
      </View>
    );
  }

  // imprecise
  return (
    <View className="flex-row items-center justify-center gap-2 bg-amber-50 rounded-xl px-4 py-3 border border-amber-200">
      <Ionicons name="warning" size={18} color="#D97706" />
      <Text className="text-amber-700 font-semibold text-center">
        GPS fraco {accuracyLabel(accuracy)}. Confirme assim mesmo ou ajuste no
        mapa.
      </Text>
    </View>
  );
};
