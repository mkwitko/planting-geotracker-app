import CustomModal from "@/src/components/modal";
import { useOfflineContext, usePlantsView } from "@/src/context/offline-context";
import { useFindAllPlantsTypes } from "@/src/http/generated/plants-type/plants-type";
import { useFindMe } from "@/src/http/generated/user/user";
import { colors } from "@/src/lib/colors";
import { convertPlantToFormData } from "@/src/lib/plants/plant-convertion";
import { Ionicons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { PlantFormData, plantFormSchema } from "./add-plants-schema";
import { StepBasicInfo } from "./steps/step-basic-info";
import { StepDetails } from "./steps/step-details";
import { StepLocation } from "./steps/step-location";
import { WizardFooter } from "./steps/wizard-footer";
import { WizardHeader } from "./steps/wizard-header";

const STEP_TITLES = ["Localização GPS", "Informações", "Detalhes (opcional)"];
const STEP_FIELDS: (keyof PlantFormData)[][] = [
  ["latitude", "longitude"],
  ["name", "typeId"],
  [],
];
const TOTAL_STEPS = STEP_TITLES.length;

export default function AddPlantScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const plantId = params.id;
  const isEditing = !!plantId;
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [openWarningModal, setOpenWarningModal] = useState(false);
  const [textModal, setTextModal] = useState({
    title: "",
    message: "",
    icon: "",
    iconColor: colors.green[500],
  });
  const [openDeleteConfirmation, setOpenDeleteConfirmation] = useState(false);

  const { isConnected, pendingCount, savePlant, deletePlant } = useOfflineContext();
  const { plants, isServerLoaded } = usePlantsView();
  const { data: user } = useFindMe();
  const { data: plantType } = useFindAllPlantsTypes();

  // Servidor + fila local: funciona offline para qualquer planta.
  const plant = useMemo(
    () => (plantId ? plants.find((p) => p.id === plantId) : undefined),
    [plants, plantId]
  );
  const isOfflineRecord = !!plant?.offline;

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    reset,
    trigger,
    watch,
    formState: { errors },
  } = useForm<PlantFormData>({
    resolver: zodResolver(plantFormSchema),
  });

  // Remonta o passo de GPS quando os dados de edição chegam,
  // para que a posição salva seja usada como semente do mapa.
  const locationSeedKey = isEditing
    ? `edit-${Boolean(watch("latitude"))}`
    : "new";

  const plantTypeOptions = useMemo(
    () =>
      plantType?.map((p) => ({ label: p.name, value: p.id })) ?? [],
    [plantType]
  );

  // Carrega o formulário uma vez só: o sync em background muda a lista e
  // não pode sobrescrever o que o usuário está editando.
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!plant || loadedRef.current) return;
    loadedRef.current = true;
    reset(convertPlantToFormData({ plantData: plant }));
  }, [plant, reset]);

  useEffect(() => {
    if (!user || !user.center) return;
    setValue("centerId", user.center.id);
  }, [user, setValue]);

  const submit = async (data: PlantFormData) => {
    setIsSubmitting(true);
    try {
      // Sempre grava na fila local; o sync sobe quando houver internet.
      await savePlant(data, plantId);
      router.back();
    } catch (error) {
      console.error("Erro ao salvar planta:", error);
      setTextModal({
        title: "Erro ao salvar planta",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar a planta no aparelho.",
        icon: "alert-circle",
        iconColor: colors.red[500],
      });
      setOpenWarningModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (plantId) await deletePlant(plantId);
    router.back();
  };

  const goNext = async () => {
    const valid = await trigger(STEP_FIELDS[step]);
    if (valid) setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  };

  const goPrev = () => setStep((s) => Math.max(0, s - 1));

  const handleBack = () => (step > 0 ? goPrev() : router.back());

  if (isEditing && isServerLoaded && !plant && !loadedRef.current) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center p-6">
          <Ionicons name="alert-circle" size={64} color="#EF4444" />
          <Text className="text-xl font-bold text-gray-800 mt-4 text-center">
            Planta não encontrada
          </Text>
          <Text className="text-gray-600 mt-2 text-center">
            Não foi possível carregar os dados da planta.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-6 bg-green-500 rounded-xl px-6 py-3"
          >
            <Text className="text-white font-bold">Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <WizardHeader
        title={STEP_TITLES[step]}
        step={step}
        totalSteps={TOTAL_STEPS}
        isConnected={isConnected}
        onBack={handleBack}
      />

      {!isConnected && (
        <View className="bg-orange-100 px-6 py-2 flex-row items-center gap-2 border-b border-orange-200">
          <Ionicons name="cloud-offline" size={16} color="#EA580C" />
          <Text className="text-orange-700 text-xs flex-1">
            Modo offline — será sincronizado quando houver internet.
            {pendingCount > 0 ? ` (${pendingCount} pendente(s))` : ""}
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {step === 0 ? (
          <StepLocation
            key={locationSeedKey}
            setValue={setValue}
            getValues={getValues}
            isEditing={isEditing}
          />
        ) : (
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingTop: 24,
              paddingBottom: insets.bottom + 24,
            }}
          >
            {isEditing && !plant && !loadedRef.current && (
              <View className="bg-green-100 rounded-xl p-4 mb-6 border border-green-200 flex-row items-center">
                <ActivityIndicator size="small" color="#16A34A" />
                <Text className="text-green-700 font-semibold ml-2">
                  Carregando dados da planta...
                </Text>
              </View>
            )}

            {step === 1 && (
              <StepBasicInfo
                control={control}
                errors={errors}
                plantTypeOptions={plantTypeOptions}
              />
            )}

            {step === 2 && <StepDetails control={control} />}
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      <WizardFooter
        step={step}
        totalSteps={TOTAL_STEPS}
        isSubmitting={isSubmitting}
        isEditing={isEditing}
        isOfflineRecord={isOfflineRecord}
        onPrev={goPrev}
        onNext={goNext}
        onSubmit={handleSubmit(submit)}
        onDelete={() => setOpenDeleteConfirmation(true)}
      />

      {openDeleteConfirmation && (
        <CustomModal
          visible={openDeleteConfirmation}
          title="Excluir Planta"
          message="Você tem certeza que deseja excluir esta planta? Esta ação não pode ser desfeita."
          actions={[
            {
              text: "Cancelar",
              onPress: () => setOpenDeleteConfirmation(false),
              style: "secondary",
            },
            {
              text: "Confirmar",
              style: "primary",
              onPress: confirmDelete,
            },
          ]}
        />
      )}

      {openWarningModal && (
        <CustomModal
          visible={openWarningModal}
          title={textModal.title}
          message={textModal.message}
          icon={textModal.icon as any}
          iconColor={textModal.iconColor}
          actions={[
            {
              text: "OK",
              onPress: () => setOpenWarningModal(false),
              style: "primary",
            },
          ]}
        />
      )}
    </SafeAreaView>
  );
}
