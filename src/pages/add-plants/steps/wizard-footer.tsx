import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/lib/colors";
import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

interface WizardFooterProps {
  step: number;
  totalSteps: number;
  isSubmitting: boolean;
  isEditing: boolean;
  isOfflineRecord: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
  onDelete?: () => void;
}

export const WizardFooter: React.FC<WizardFooterProps> = ({
  step,
  totalSteps,
  isSubmitting,
  isEditing,
  isOfflineRecord,
  onPrev,
  onNext,
  onSubmit,
  onDelete,
}) => {
  const isLastStep = step === totalSteps - 1;

  const submitLabel = isOfflineRecord
    ? "Sincronizar"
    : isEditing
    ? "Atualizar"
    : "Adicionar Planta";

  return (
    <View className="bg-white px-6 py-4 border-t border-gray-100 gap-3">
      <View className="flex-row gap-3">
        {step > 0 && (
          <TouchableOpacity
            onPress={onPrev}
            disabled={isSubmitting}
            className="flex-1 rounded-xl py-4 border border-gray-300 items-center justify-center"
          >
            <Text className="text-gray-700 font-semibold text-base">
              Voltar
            </Text>
          </TouchableOpacity>
        )}

        {isLastStep ? (
          <TouchableOpacity
            onPress={onSubmit}
            disabled={isSubmitting}
            className="flex-1 rounded-xl py-4 bg-green-600 disabled:opacity-50 flex-row items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="leaf" size={20} color="#fff" />
            )}
            <Text className="text-white font-bold text-base">
              {submitLabel}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onNext}
            className="flex-1 rounded-xl py-4 bg-green-600 flex-row items-center justify-center gap-2"
          >
            <Text className="text-white font-bold text-base">Próximo</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {isLastStep && isEditing && onDelete && (
        <TouchableOpacity
          onPress={onDelete}
          disabled={isSubmitting}
          className="rounded-xl py-3 border border-red-500 flex-row items-center justify-center gap-2"
        >
          <Ionicons name="trash-outline" size={18} color={colors.red[500]} />
          <Text className="text-red-500 font-semibold">Excluir Planta</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
