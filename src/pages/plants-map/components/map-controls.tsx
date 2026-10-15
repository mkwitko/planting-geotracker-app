import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { MapTypeName } from "./map-type";

interface MapControlsProps {
  mapType: MapTypeName;
  onCycleMapType: () => void;
  pendingCount: number;
  isSyncing: boolean;
  isConnected: boolean;
  onSync: () => void;
}

const MAP_TYPE_LABEL: Record<MapTypeName, string> = {
  standard: "Mapa",
  satellite: "Satélite",
  hybrid: "Híbrido",
};

export const MapControls: React.FC<MapControlsProps> = ({
  mapType,
  onCycleMapType,
  pendingCount,
  isSyncing,
  isConnected,
  onSync,
}) => {
  return (
    <View className="gap-2 items-start">
      <TouchableOpacity
        onPress={onCycleMapType}
        className="flex-row items-center gap-1 bg-white rounded-full px-3 py-2 shadow-lg"
      >
        <Ionicons name="layers" size={16} color="#374151" />
        <Text className="text-gray-700 text-xs font-semibold">
          {MAP_TYPE_LABEL[mapType]}
        </Text>
      </TouchableOpacity>

      {pendingCount > 0 && (
        <TouchableOpacity
          onPress={onSync}
          disabled={isSyncing || !isConnected}
          className={`flex-row items-center gap-1 rounded-full px-3 py-2 shadow-lg ${
            isConnected ? "bg-green-600" : "bg-gray-400"
          }`}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="sync" size={16} color="#fff" />
          )}
          <Text className="text-white text-xs font-semibold">
            {isSyncing ? "Sincronizando…" : `Sincronizar (${pendingCount})`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
