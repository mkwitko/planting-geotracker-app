import { Ionicons } from "@expo/vector-icons";
import * as ImagePickerExpo from "expo-image-picker";
import React, { useState } from "react";
import { Control, Controller } from "react-hook-form";
import {
  Alert,
  Animated,
  Image,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { persistPlantImage } from "@/src/lib/plants/image-storage";
import { PlantFormData } from "../add-plants-schema";

interface ImagePickerComponentProps {
  control: Control<PlantFormData>;
  name: keyof PlantFormData;
}

export const ImagePickerComponent: React.FC<ImagePickerComponentProps> = ({
  control,
  name,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [imageViewVisible, setImageViewVisible] = useState(false);
  const [scaleValue] = useState(new Animated.Value(0));

  const showModal = () => {
    setModalVisible(true);
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
      tension: 150,
      friction: 6,
    }).start();
  };

  const hideModal = () => {
    Animated.timing(scaleValue, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
    });
  };

  const handleImagePicker = (onChange: (value: string) => void) => {
    showModal();
  };

  const handleImageView = (event: any) => {
    // Previne propagação para evitar conflito com o onPress do container
    event.stopPropagation();
    setImageViewVisible(true);
  };

  const hideImageView = () => {
    setImageViewVisible(false);
  };

  const handleCameraPress = async (onChange: (value: string) => void) => {
    hideModal();

    const { status } = await ImagePickerExpo.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permissão necessária",
        "Precisamos de permissão para acessar a câmera."
      );
      return;
    }

    const result = await ImagePickerExpo.launchCameraAsync({
      mediaTypes: ImagePickerExpo.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      // Copia para diretório permanente para não perder a foto offline.
      const persisted = await persistPlantImage(result.assets[0].uri);
      onChange(persisted);
    }
  };

  const handleGalleryPress = async (onChange: (value: string) => void) => {
    hideModal();

    const result = await ImagePickerExpo.launchImageLibraryAsync({
      mediaTypes: ImagePickerExpo.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const persisted = await persistPlantImage(result.assets[0].uri);
      onChange(persisted);
    }
  };

  const ImageViewModal = ({ imageUri }: { imageUri: string }) => (
    <Modal
      transparent={true}
      visible={imageViewVisible}
      onRequestClose={hideImageView}
      animationType="fade"
    >
      <View className="flex-1 bg-black">
        {/* Header com botão de fechar */}
        <View className="absolute top-12 right-4 z-10">
          <TouchableOpacity
            onPress={hideImageView}
            className="bg-black bg-opacity-70 rounded-full p-3"
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Imagem em tela cheia */}
        <Pressable
          className="flex-1 justify-center items-center"
          onPress={hideImageView}
        >
          <Image
            source={{ uri: imageUri }}
            className="w-full h-full"
            resizeMode="contain"
          />
        </Pressable>
      </View>
    </Modal>
  );

  const ImagePickerModal = ({
    onChange,
    currentImage,
  }: {
    onChange: (value: string) => void;
    currentImage?: string;
  }) => (
    <Modal
      transparent={true}
      visible={modalVisible}
      onRequestClose={hideModal}
      animationType="fade"
    >
      <Pressable
        className="flex-1 bg-black bg-opacity-50 justify-center items-center px-6"
        onPress={hideModal}
      >
        <Animated.View
          style={{
            transform: [{ scale: scaleValue }],
          }}
          className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl"
        >
          <Pressable onPress={() => {}}>
            {/* Header do Modal */}
            <View className="items-center mb-6">
              <View className="bg-green-100 rounded-full p-4 mb-3">
                <Ionicons name="camera" size={32} color="#22C55E" />
              </View>
              <Text className="text-xl font-bold text-gray-800">
                {currentImage ? "Alterar Foto" : "Adicionar Foto"}
              </Text>
              <Text className="text-gray-500 text-center mt-2">
                Escolha uma opção para {currentImage ? "alterar" : "adicionar"}{" "}
                sua foto
              </Text>
            </View>

            {/* Preview da imagem atual na modal (se existir) */}
            {currentImage && (
              <View className="mb-6">
                <Text className="text-gray-700 font-semibold mb-3 text-center">
                  Foto atual:
                </Text>
                <View className="relative">
                  <Image
                    source={{ uri: currentImage }}
                    className="w-full h-32 rounded-2xl"
                    resizeMode="cover"
                  />
                  {/* Botão de visualizar dentro da modal */}
                  <TouchableOpacity
                    onPress={() => {
                      hideModal();
                      setTimeout(() => setImageViewVisible(true), 300);
                    }}
                    className="absolute top-2 right-2 bg-blue-500 bg-opacity-90 rounded-full p-2"
                    activeOpacity={0.8}
                  >
                    <Ionicons name="eye" size={16} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Botões de Ação */}
            <View className="gap-4">
              <TouchableOpacity
                onPress={() => handleCameraPress(onChange)}
                className="bg-blue-500 rounded-2xl p-4 flex-row items-center justify-center shadow-lg"
                activeOpacity={0.8}
              >
                <Ionicons name="camera" size={24} color="white" />
                <Text className="text-white font-semibold text-lg ml-3">
                  Câmera
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleGalleryPress(onChange)}
                className="bg-green-500 rounded-2xl p-4 flex-row items-center justify-center shadow-lg"
                activeOpacity={0.8}
              >
                <Ionicons name="images" size={24} color="white" />
                <Text className="text-white font-semibold text-lg ml-3">
                  Galeria
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={hideModal}
                className="bg-gray-100 rounded-2xl p-4 flex-row items-center justify-center border border-gray-200"
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={24} color="#6B7280" />
                <Text className="text-gray-600 font-semibold text-lg ml-3">
                  Cancelar
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value } }) => (
        <>
          <TouchableOpacity
            onPress={() => handleImagePicker(onChange)}
            className="bg-white rounded-2xl p-6 mb-8 items-center justify-center shadow-lg border border-gray-100"
            style={{ height: 220 }}
            activeOpacity={0.8}
          >
            {value ? (
              <View className="relative w-full h-full">
                <Image
                  source={{ uri: value as string }}
                  className="w-full h-full rounded-2xl"
                  resizeMode="cover"
                />
                <View className="absolute top-3 right-3 bg-black bg-opacity-50 rounded-full p-2">
                  <Ionicons name="pencil" size={16} color="white" />
                </View>

                {/* Botão para visualizar - melhorado */}
                <View className="absolute bottom-3 right-3">
                  <TouchableOpacity
                    onPress={handleImageView}
                    className="bg-green-500 bg-opacity-90 rounded-full p-3"
                    activeOpacity={0.8}
                    style={{
                      elevation: 5,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.25,
                    }}
                  >
                    <Ionicons name="eye" size={18} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View className="items-center">
                <View className="bg-green-100 rounded-full p-6 mb-4">
                  <Ionicons name="camera" size={48} color="#22C55E" />
                </View>
                <Text className="text-gray-700 text-lg font-semibold">
                  Adicionar Foto
                </Text>
                <Text className="text-gray-500 text-center mt-2 max-w-xs">
                  Toque para tirar uma foto ou escolher da galeria
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <ImagePickerModal
            onChange={onChange}
            currentImage={value as string}
          />
          {value && <ImageViewModal imageUri={value as string} />}
        </>
      )}
    />
  );
};
