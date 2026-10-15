import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { TypeCount } from "../hooks/use-map-plants";
import { MapFilters as Filters } from "../types";

interface MapFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  typeCounts: TypeCount[];
  total: number;
  onlineCount: number;
  offlineCount: number;
}

const Chip: React.FC<{
  label: string;
  active: boolean;
  color?: string;
  onPress: () => void;
}> = ({ label, active, color, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 border ${
      active ? "bg-green-600 border-green-600" : "bg-white border-gray-300"
    }`}
  >
    {color && (
      <View
        className="w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
    )}
    <Text
      className={`text-xs font-semibold ${
        active ? "text-white" : "text-gray-700"
      }`}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

export const MapFilters: React.FC<MapFiltersProps> = ({
  filters,
  onChange,
  typeCounts,
  total,
  onlineCount,
  offlineCount,
}) => {
  const [open, setOpen] = useState(false);

  const toggleType = (typeId: string) => {
    const next = filters.typeIds.includes(typeId)
      ? filters.typeIds.filter((id) => id !== typeId)
      : [...filters.typeIds, typeId];
    onChange({ ...filters, typeIds: next });
  };

  const hasFilter =
    filters.typeIds.length > 0 || !filters.showOnline || !filters.showOffline;

  return (
    <View className="items-start gap-2">
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center gap-1.5 bg-white rounded-full px-3 py-2 shadow-lg"
      >
        <Ionicons
          name={hasFilter ? "funnel" : "funnel-outline"}
          size={16}
          color="#16A34A"
        />
        <Text className="text-gray-800 text-xs font-bold">
          {total} planta{total === 1 ? "" : "s"}
        </Text>
      </TouchableOpacity>

      {open && (
        <View
          className="bg-white rounded-2xl p-3 shadow-xl"
          style={{ maxWidth: 260 }}
        >
          <Text className="text-gray-500 text-[10px] font-bold uppercase mb-2">
            Status
          </Text>
          <View className="flex-row gap-2 mb-3">
            <Chip
              label={`Online (${onlineCount})`}
              active={filters.showOnline}
              onPress={() =>
                onChange({ ...filters, showOnline: !filters.showOnline })
              }
            />
            <Chip
              label={`Offline (${offlineCount})`}
              active={filters.showOffline}
              onPress={() =>
                onChange({ ...filters, showOffline: !filters.showOffline })
              }
            />
          </View>

          {typeCounts.some((t) => t.typeId !== "none") && (
            <>
              <Text className="text-gray-500 text-[10px] font-bold uppercase mb-2">
                Tipos
              </Text>
              <ScrollView style={{ maxHeight: 180 }}>
                <View className="flex-row flex-wrap gap-2">
                  {typeCounts
                    .filter((t) => t.typeId !== "none")
                    .map((t) => (
                      <Chip
                        key={t.typeId}
                        label={`${t.typeName} (${t.count})`}
                        color={t.color}
                        active={filters.typeIds.includes(t.typeId)}
                        onPress={() => toggleType(t.typeId)}
                      />
                    ))}
                </View>
              </ScrollView>
            </>
          )}

          {hasFilter && (
            <TouchableOpacity
              onPress={() =>
                onChange({ typeIds: [], showOnline: true, showOffline: true })
              }
              className="mt-3 items-center"
            >
              <Text className="text-green-600 text-xs font-semibold">
                Limpar filtros
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};
