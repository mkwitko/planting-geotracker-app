import React from "react";
import { Text, View } from "react-native";

interface FormFieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  error?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  required = false,
  children,
  error,
}) => (
  <View className="mb-6">
    <Text className="text-gray-800 font-bold mb-3 text-base">
      {label} {required && <Text className="text-red-500">*</Text>}
    </Text>
    {children}
    {error && <Text className="text-red-500 text-sm mt-1">{error}</Text>}
  </View>
);
