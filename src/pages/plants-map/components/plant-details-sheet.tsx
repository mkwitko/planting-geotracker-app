import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { MapPlant } from "../types";

interface PlantDetailsSheetProps {
  plant: MapPlant;
  onClose: () => void;
}

const formatDate = (date?: string | Date | null) => {
  if (!date) return null;
  const parsed = typeof date === "string" ? new Date(date) : date;
  if (isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("pt-BR");
};

const Info: React.FC<{ label: string; value?: string | null }> = ({
  label,
  value,
}) =>
  value ? (
    <View className="mb-3">
      <Text className="text-sm font-semibold text-gray-700 mb-1">{label}</Text>
      <Text className="text-sm text-gray-600">{value}</Text>
    </View>
  ) : null;

export const PlantDetailsSheet: React.FC<PlantDetailsSheetProps> = ({
  plant,
  onClose,
}) => {
  const raw = plant.raw ?? {};
  const imageUri: string | undefined = raw.image || undefined;

  const careDates = [
    { label: "Plantio", value: formatDate(raw.plantationDate) },
    { label: "Última rega", value: formatDate(raw.lastWatering) },
    { label: "Última fertilização", value: formatDate(raw.lastFertilization) },
    { label: "Última poda", value: formatDate(raw.lastPruning) },
  ].filter((d) => d.value);

  return (
    <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 shadow-2xl max-h-96">
      <TouchableOpacity
        onPress={onClose}
        className="absolute top-4 right-4 p-2 z-10"
      >
        <Ionicons name="close" size={24} color="#666" />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center mb-4">
          <View
            className="w-4 h-4 rounded-full mr-3"
            style={{ backgroundColor: plant.color }}
          />
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-800">
              {plant.name}
            </Text>
            <View className="flex-row items-center gap-2">
              <Text className="text-sm text-gray-600">{plant.typeName}</Text>
              <Text className="text-gray-300">•</Text>
              <View className="flex-row items-center gap-1">
                <Ionicons
                  name={plant.offline ? "cloud-offline" : "cloud-done"}
                  size={12}
                  color={plant.offline ? "#EA580C" : "#16A34A"}
                />
                <Text
                  className={`text-xs ${
                    plant.offline ? "text-orange-600" : "text-green-600"
                  }`}
                >
                  {plant.offline ? "Offline" : "Sincronizada"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {imageUri && (
          <Image
            source={{ uri: imageUri }}
            style={{
              width: "100%",
              height: 180,
              borderRadius: 16,
              marginBottom: 16,
            }}
            contentFit="cover"
            transition={200}
          />
        )}

        <Info label="Descrição" value={raw.description} />
        <Info label="Número de Identificação" value={raw.identificationNumber} />
        <Info label="Origem" value={raw.origin} />
        <Info label="Endereço" value={raw.address} />

        <View className="mb-3">
          <Text className="text-sm font-semibold text-gray-700 mb-1">
            Coordenadas
          </Text>
          <Text className="text-sm text-gray-600">
            {plant.latitude.toFixed(6)}, {plant.longitude.toFixed(6)}
          </Text>
        </View>

        {careDates.length > 0 && (
          <View className="mb-3">
            <Text className="text-sm font-semibold text-gray-700 mb-2">
              Histórico de Cuidados
            </Text>
            {careDates.map((d) => (
              <Text key={d.label} className="text-xs text-gray-600">
                {d.label}: {d.value}
              </Text>
            ))}
          </View>
        )}

        <Info label="Observações" value={raw.observation} />
      </ScrollView>
    </View>
  );
};
