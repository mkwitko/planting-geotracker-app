import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo } from "react";
import { UseFormGetValues, UseFormSetValue } from "react-hook-form";
import { Text, TouchableOpacity, View } from "react-native";
import { PlantFormData } from "../add-plants-schema";
import { GpsStatusCard } from "../components/gps-status-card";
import { LocationMap } from "../components/location-map";
import { GpsCoords, useGpsCapture } from "../hooks/use-gps-capture";

interface StepLocationProps {
  setValue: UseFormSetValue<PlantFormData>;
  getValues: UseFormGetValues<PlantFormData>;
  isEditing: boolean;
}

const parseInitialCoords = (
  lat?: string,
  lng?: string
): GpsCoords | null => {
  const latitude = parseFloat(lat ?? "");
  const longitude = parseFloat(lng ?? "");
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
  return { latitude, longitude };
};

export const StepLocation: React.FC<StepLocationProps> = ({
  setValue,
  getValues,
  isEditing,
}) => {
  const initialCoords = useMemo(
    () => parseInitialCoords(getValues("latitude"), getValues("longitude")),
    [getValues]
  );

  const {
    coords,
    accuracy,
    sampleCount,
    status,
    isManual,
    requiredSamples,
    start,
    setManualCoords,
  } = useGpsCapture({ initialCoords, autoStart: !isEditing });

  // Mantém o formulário sempre em sincronia com a melhor posição atual.
  useEffect(() => {
    if (!coords) return;
    setValue("latitude", String(coords.latitude), { shouldValidate: true });
    setValue("longitude", String(coords.longitude), { shouldValidate: true });
  }, [coords, setValue]);

  return (
    <View className="flex-1">
      <View className="px-6 pt-4 pb-3 gap-3">
        <Text className="text-gray-600 text-center">
          Aponte o aparelho na planta e aguarde a precisão estabilizar. Arraste
          o marcador para ajustar.
        </Text>

        <GpsStatusCard
          status={status}
          accuracy={accuracy}
          sampleCount={sampleCount}
          requiredSamples={requiredSamples}
          isManual={isManual}
        />
      </View>

      <View className="flex-1 mx-4 rounded-2xl overflow-hidden border border-gray-200">
        {coords ? (
          <LocationMap
            coords={coords}
            accuracy={accuracy}
            showAccuracyCircle={status === "imprecise"}
            onMarkerDrag={setManualCoords}
          />
        ) : (
          <View className="flex-1 items-center justify-center bg-gray-100">
            <Ionicons name="location-outline" size={48} color="#9CA3AF" />
            <Text className="text-gray-500 mt-2">Aguardando localização…</Text>
          </View>
        )}
      </View>

      <View className="px-6 py-3">
        <TouchableOpacity
          onPress={() => start()}
          className="flex-row items-center justify-center gap-2 rounded-xl py-3 border border-green-500"
        >
          <Ionicons name="refresh" size={18} color="#16A34A" />
          <Text className="text-green-600 font-semibold">
            {coords ? "Recapturar GPS" : "Capturar GPS"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
