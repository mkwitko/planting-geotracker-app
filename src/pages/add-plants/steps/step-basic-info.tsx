import React from "react";
import { Control, FieldErrors } from "react-hook-form";
import { Text, View } from "react-native";
import { PlantFormData } from "../add-plants-schema";
import { FormField } from "../components/form-fields";
import { FormInput } from "../components/form-input";
import { ImagePickerComponent } from "../components/image-picker";
import { FormSelect } from "../components/select";

interface PlantTypeOption {
  label: string;
  value: string;
}

interface StepBasicInfoProps {
  control: Control<PlantFormData>;
  errors: FieldErrors<PlantFormData>;
  plantTypeOptions: PlantTypeOption[];
}

export const StepBasicInfo: React.FC<StepBasicInfoProps> = ({
  control,
  errors,
  plantTypeOptions,
}) => {
  return (
    <View>
      <ImagePickerComponent control={control} name="image" />

      <View className="bg-white rounded-2xl p-6 mb-6 shadow-lg border border-gray-100">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-lg font-bold text-gray-800">
            Informações Básicas
          </Text>
          <Text className="text-xs text-red-500 font-bold">
            * Campos obrigatórios
          </Text>
        </View>

        <FormField
          label="Identificação da Planta"
          error={errors.name?.message}
          required
        >
          <FormInput
            control={control}
            name="name"
            placeholder="Ex: Mariri 01"
            maxLength={100}
          />
        </FormField>

        <FormField label="Tipo" required error={errors.typeId?.message}>
          <FormSelect
            control={control}
            name="typeId"
            options={plantTypeOptions}
            placeholder="Selecione seu tipo de planta"
          />
        </FormField>

        <FormField label="Descrição">
          <FormInput
            control={control}
            name="description"
            placeholder="Adicione observações a respeito da planta."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={{ minHeight: 100 }}
            maxLength={500}
          />
        </FormField>

        <FormField label="Origem" error={errors.origin?.message}>
          <FormInput
            control={control}
            name="origin"
            placeholder="Ex: Floresta Amazônica, Acre"
            maxLength={100}
          />
        </FormField>
      </View>
    </View>
  );
};
