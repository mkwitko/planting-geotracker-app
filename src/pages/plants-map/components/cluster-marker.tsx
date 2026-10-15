import React from "react";
import { Text, View } from "react-native";
import { Marker } from "react-native-maps";

interface ClusterMarkerProps {
  latitude: number;
  longitude: number;
  count: number;
  onPress: () => void;
}

/** Bolha de agrupamento com a contagem de plantas. Toque = zoom in. */
export const ClusterMarker: React.FC<ClusterMarkerProps> = ({
  latitude,
  longitude,
  count,
  onPress,
}) => {
  const size = count > 50 ? 56 : count > 10 ? 48 : 40;

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      onPress={onPress}
      tracksViewChanges={false}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View
        className="items-center justify-center rounded-full border-2 border-white"
        style={{
          width: size,
          height: size,
          backgroundColor: "rgba(22,163,74,0.9)",
        }}
      >
        <Text className="text-white font-bold">{count}</Text>
      </View>
    </Marker>
  );
};
