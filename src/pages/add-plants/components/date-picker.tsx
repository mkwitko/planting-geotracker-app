import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import { Control, Controller } from "react-hook-form";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import { PlantFormData } from "../add-plants-schema";

interface DatePickerComponentProps {
  control: Control<PlantFormData>;
  name: keyof PlantFormData;
  placeholder?: string;
}

export const DatePickerComponent: React.FC<DatePickerComponentProps> = ({
  control,
  name,
  placeholder = "Selecione a data",
}) => {
  const [showPicker, setShowPicker] = useState(false);

  const formatDate = (date: Date | undefined): string => {
    if (!date) return placeholder;
    return date.toLocaleDateString("pt-BR");
  };

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value } }) => (
        <View>
          <TouchableOpacity
            onPress={() => setShowPicker(true)}
            className="bg-white rounded-xl px-4 py-4 shadow-sm border border-gray-200 flex-row items-center justify-between"
          >
            <Text
              className={`text-base ${
                value ? "text-gray-900" : "text-gray-400"
              }`}
            >
              {formatDate(value as Date)}
            </Text>
            <Ionicons name="calendar-outline" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          {showPicker && (
            <DateTimePicker
              value={(value as Date) || new Date()}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, selectedDate) => {
                setShowPicker(Platform.OS === "ios");
                if (selectedDate) {
                  onChange(selectedDate);
                }
              }}
            />
          )}
        </View>
      )}
    />
  );
};
