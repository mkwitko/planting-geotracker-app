import React from "react";
import { Control, Controller } from "react-hook-form";
import { TextInput, TextInputProps } from "react-native";
import { PlantFormData } from "../add-plants-schema";

interface FormInputProps
  extends Omit<TextInputProps, "value" | "onChangeText"> {
  control: Control<PlantFormData>;
  name: keyof PlantFormData;
}

export const FormInput: React.FC<FormInputProps> = ({
  control,
  name,
  ...props
}) => {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value } }) => (
        <TextInput
          value={(value as string) || ""}
          onChangeText={onChange}
          className="bg-white rounded-xl px-5 py-4 text-gray-900 shadow-sm border border-gray-200 text-base"
          placeholderTextColor="#9CA3AF"
          {...props}
        />
      )}
    />
  );
};
