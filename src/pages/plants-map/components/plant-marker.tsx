import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";
import { Marker } from "react-native-maps";
import { MapPlant } from "../types";

interface PlantMarkerProps {
  plant: MapPlant;
  onPress: (plant: MapPlant) => void;
}

/**
 * Marcador com rótulo (nome) e cor por tipo. O padding ao redor evita o
 * clipping do bitmap do Marker no Android. `tracksViewChanges` fica ligado:
 * no Android o bitmap cacheia a primeira medida (estreita) e trunca o nome se
 * desligado cedo. O cluster limita a quantidade de marcadores visíveis.
 */
export const PlantMarker: React.FC<PlantMarkerProps> = ({
  plant,
  onPress,
}) => {
  return (
    <Marker
      coordinate={{ latitude: plant.latitude, longitude: plant.longitude }}
      onPress={() => onPress(plant)}
    >
      <View className="items-center">
        <View
          className="px-2 py-0.5 rounded-full bg-white border"
          style={{ borderColor: plant.color }}
        >
          <Text
            className="text-[10px] font-bold"
            style={{ color: plant.color }}
          >
            {plant.name}
          </Text>
        </View>

        <View
          className="mt-0.5 w-5 h-5 rounded-full border-2 border-white items-center justify-center"
          style={{ backgroundColor: plant.color }}
        >
          {plant.offline && (
            <Ionicons name="cloud-offline" size={10} color="#fff" />
          )}
        </View>
      </View>
    </Marker>
  );
};
