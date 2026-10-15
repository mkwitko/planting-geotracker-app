import React, { useState } from "react";
import { Control, Controller, FieldPath, FieldValues } from "react-hook-form";
import { FlatList, Modal, Text, TouchableOpacity, View } from "react-native";

interface SelectOption {
  label: string;
  value: string | number;
}

interface FormSelectProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> {
  control: Control<TFieldValues>;
  name: TName;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
}

export const FormSelect = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  control,
  name,
  options,
  placeholder = "Selecione uma opção",
  disabled = false,
}: FormSelectProps<TFieldValues, TName>) => {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value } }) => (
        <SelectComponent
          options={options}
          value={value}
          placeholder={placeholder}
          onSelect={onChange}
          disabled={disabled}
        />
      )}
    />
  );
};

interface SelectComponentProps {
  options: SelectOption[];
  value?: string | number;
  placeholder?: string;
  onSelect: (value: string | number) => void;
  disabled?: boolean;
}

const SelectComponent: React.FC<SelectComponentProps> = ({
  options,
  value,
  placeholder = "Selecione uma opção",
  onSelect,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  const handleSelect = (selectedValue: string | number) => {
    onSelect(selectedValue);
    setIsOpen(false);
  };

  return (
    <View>
      <TouchableOpacity
        onPress={() => !disabled && setIsOpen(true)}
        className={`
          border border-gray-300 rounded-xl px-4 py-3 bg-white
          ${disabled ? "bg-gray-100 opacity-60" : ""}
        `}
        activeOpacity={disabled ? 1 : 0.7}
      >
        <Text
          className={`text-base ${
            selectedOption ? "text-gray-800" : "text-gray-400"
          }`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
          className="flex-1 bg-black/80 justify-end"
        >
          <TouchableOpacity
            activeOpacity={1}
            className="bg-white rounded-t-3xl pt-4 px-6 pb-8 shadow-xl max-h-[70%]"
            onPress={() => {}} // impede que o toque feche ao clicar no modal
          >
            <View className="items-center mb-4">
              <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </View>

            <Text className="text-lg font-semibold text-gray-700 mb-4 text-center">
              {placeholder}
            </Text>

            <FlatList
              data={options}
              keyExtractor={(item) => item.value.toString()}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleSelect(item.value)}
                  className={`
                    px-4 py-4 rounded-xl mb-2
                    ${item.value === value ? "bg-green-100" : "bg-gray-100"}
                  `}
                >
                  <Text
                    className={`text-base ${
                      item.value === value
                        ? "text-green-700 font-semibold"
                        : "text-gray-800"
                    }`}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              onPress={() => setIsOpen(false)}
              className="mt-4 bg-gray-200 py-3 rounded-xl items-center"
            >
              <Text className="text-gray-700 font-medium">Fechar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};
