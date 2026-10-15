import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface WizardHeaderProps {
  title: string;
  step: number;
  totalSteps: number;
  isConnected: boolean;
  onBack: () => void;
}

export const WizardHeader: React.FC<WizardHeaderProps> = ({
  title,
  step,
  totalSteps,
  isConnected,
  onBack,
}) => {
  return (
    <View className="bg-white px-6 py-4 shadow-lg" style={{ zIndex: 1000 }}>
      <View className="flex-row items-center justify-between">
        <TouchableOpacity
          onPress={onBack}
          className="p-2 bg-gray-100 rounded-full"
        >
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>

        <View className="items-center">
          <Text className="text-gray-900 text-lg font-bold">{title}</Text>
          <View className="flex-row items-center mt-1">
            <View
              className={`w-2 h-2 rounded-full mr-2 ${
                isConnected ? "bg-green-500" : "bg-orange-500"
              }`}
            />
            <Text
              className={`text-xs ${
                isConnected ? "text-green-600" : "text-orange-600"
              }`}
            >
              {isConnected ? "Online" : "Offline"}
            </Text>
          </View>
        </View>

        <Text className="text-gray-400 text-sm font-semibold w-10 text-right">
          {step + 1}/{totalSteps}
        </Text>
      </View>

      {/* Barra de progresso */}
      <View className="flex-row gap-2 mt-3">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <View
            key={index}
            className={`flex-1 h-1.5 rounded-full ${
              index <= step ? "bg-green-500" : "bg-gray-200"
            }`}
          />
        ))}
      </View>
    </View>
  );
};
