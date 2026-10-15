import React from "react";
import { Control } from "react-hook-form";
import { Text, View } from "react-native";
import { PlantFormData } from "../add-plants-schema";
import { DatePickerComponent } from "../components/date-picker";
import { FormField } from "../components/form-fields";
import { FormInput } from "../components/form-input";

interface StepDetailsProps {
  control: Control<PlantFormData>;
}

const MAINTENANCE_DATES: { name: keyof PlantFormData; label: string }[] = [
  { name: "lastWatering", label: "Derradeira Rega" },
  { name: "lastFertilization", label: "Derradeira Fertilização" },
  { name: "lastPestControl", label: "Derradeiro Controle de Pragas" },
  { name: "lastPruning", label: "Derradeira Poda" },
  { name: "lastHarvest", label: "Derradeira Colheita" },
  { name: "lastWeeding", label: "Derradeira Capina" },
  { name: "lastSoilAnalysis", label: "Derradeira Análise do Solo" },
];

export const StepDetails: React.FC<StepDetailsProps> = ({ control }) => {
  return (
    <View>
      <View className="bg-white rounded-2xl p-6 mb-6 shadow-lg border border-gray-100">
        <Text className="text-lg font-bold text-gray-800 mb-4">
          Informações Adicionais
        </Text>

        <FormField label="Observações">
          <FormInput
            control={control}
            name="observation"
            placeholder="Observações..."
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={{ minHeight: 80 }}
          />
        </FormField>

        <FormField label="Número de Identificação">
          <FormInput
            control={control}
            name="identificationNumber"
            placeholder="Ex: P001, PLANT-2024-001..."
          />
        </FormField>

        <FormField label="Data de Plantação">
          <DatePickerComponent
            control={control}
            name="plantationDate"
            placeholder="Selecione a data"
          />
        </FormField>

        <FormField label="Data da Foto">
          <DatePickerComponent
            control={control}
            name="pictureDate"
            placeholder="Selecione a data"
          />
        </FormField>
      </View>

      <View className="bg-white rounded-2xl p-6 mb-6 shadow-lg border border-gray-100">
        <Text className="text-lg font-bold text-gray-800 mb-4">
          Datas de Manutenção
        </Text>

        {MAINTENANCE_DATES.map(({ name, label }) => (
          <FormField key={name} label={label}>
            <DatePickerComponent
              control={control}
              name={name}
              placeholder="Selecione a data"
            />
          </FormField>
        ))}
      </View>
    </View>
  );
};
