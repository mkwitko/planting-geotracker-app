import CustomModal from "@/src/components/modal";
import { useOfflineContext, usePlantsView } from "@/src/context/offline-context";
import { useFindAllPlantsTypes } from "@/src/http/generated/plants-type/plants-type";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Fuse from "fuse.js";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// Tipos para melhor tipagem
type FilterType = "todos" | "tucunaca" | "caupuri" | "chacrona";

export default function PlantsListScreen() {
  const [searchText, setSearchText] = useState("");
  const [filterBy, setFilterBy] = useState<FilterType>("todos");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPlants, setSelectedPlants] = useState<Set<string>>(new Set());

  const { plants: plantsMerge } = usePlantsView();
  const { data: plantTypes } = useFindAllPlantsTypes();

  const [confirmSync, setConfirmSync] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    ops,
    pendingCount,
    failedCount,
    isSyncing,
    syncNow,
    deletePlant,
    retryOp,
    discardOp,
  } = useOfflineContext();

  const syncAllOfflinePlants = () => syncNow();

  const deleteSelectedPlants = async () => {
    if (selectedPlants.size === 0) return;
    setIsDeleting(true);
    // Vai para a fila: funciona offline e sobe no próximo sync.
    for (const plantId of selectedPlants) {
      try {
        await deletePlant(plantId);
      } catch (error) {
        console.error(`Erro ao deletar planta com id ${plantId}:`, error);
      }
    }
    setSelectedPlants(new Set());
    setIsSelectionMode(false);
    setIsDeleting(false);
  };

  const togglePlantSelection = (plantId: string) => {
    const newSelection = new Set(selectedPlants);
    if (newSelection.has(plantId)) {
      newSelection.delete(plantId);
    } else {
      newSelection.add(plantId);
    }
    setSelectedPlants(newSelection);
  };

  const selectAllPlants = () => {
    const allPlantIds = filteredPlants
      .map((plant) => plant.id)
      .filter((id): id is string => typeof id === "string");
    setSelectedPlants(new Set(allPlantIds));
  };

  const clearSelection = () => {
    setSelectedPlants(new Set());
    setIsSelectionMode(false);
  };

  // Configuração do Fuse.js para busca fuzzy
  const fuse = useMemo(() => {
    const dynamicKeys = Object.keys(plantsMerge[0] || {}).flatMap((key) => {
      if (["id", "typeId", "offline", "syncError", "center", "type"].includes(key)) return [];
      return { name: key, weight: 0.5 };
    });

    const options = {
      keys: [
        ...dynamicKeys,
        { name: "name", weight: 0.7 },
        { name: "typeName", weight: 0.7 }, // para permitir busca por nome do tipo
      ],
      threshold: 0.3,
      includeScore: true,
      minMatchCharLength: 2,
    };

    // Adiciona o nome do tipo para cada planta para facilitar a busca
    const plantsWithTypeName = plantsMerge.map((plant) => ({
      ...plant,
      typeName:
        plantTypes?.find((type) => type.id === plant.typeId)?.name || "",
    }));

    return new Fuse(plantsWithTypeName, options);
  }, [plantsMerge, plantTypes]);

  // Aplicar filtros e busca
  const filteredPlants = useMemo(() => {
    let filtered = plantsMerge;

    // Aplicar filtro por tipo
    if (filterBy !== "todos") {
      let typeSearch = filterBy.toLowerCase();

      if (filterBy === "tucunaca") typeSearch = "Mariri Tucunacá";
      if (filterBy === "caupuri") typeSearch = "Mariri Caupuri";

      const typeFilter = plantTypes?.find(
        (type) => type.name.toLowerCase() === typeSearch.toLowerCase()
      );
      if (typeFilter) {
        filtered = filtered.filter((plant) => plant.typeId === typeFilter.id);
      }
    }

    // Aplicar busca com Fuse.js
    if (searchText.trim()) {
      const searchResults = fuse.search(searchText);
      const searchedPlantIds = new Set(
        searchResults.map((result) => result.item.id)
      );
      filtered = filtered.filter((plant) => searchedPlantIds.has(plant.id));
    }

    // Ordenar: plantas offline primeiro
    return filtered.sort((a, b) => {
      if (a.offline && !b.offline) return -1;
      if (!a.offline && b.offline) return 1;
      return 0;
    });
  }, [plantsMerge, plantTypes, filterBy, searchText, fuse]);

  // Contar plantas por tipo
  const getCountByType = (type: FilterType) => {
    if (type === "todos") return plantsMerge.length;

    let typeSearch = type.toLowerCase();

    if (type === "tucunaca") typeSearch = "Mariri Tucunacá";
    if (type === "caupuri") typeSearch = "Mariri Caupuri";

    const typeData = plantTypes?.find(
      (t) => t.name.toLowerCase() === typeSearch.toLowerCase()
    );
    if (!typeData) return 0;

    return plantsMerge.filter((plant) => plant.typeId === typeData.id).length;
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-6 py-4 shadow-sm">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-gray-900 text-2xl font-bold">
            Minhas Plantas
          </Text>
          {!isSelectionMode ? (
            <TouchableOpacity
              onPress={() => setIsSelectionMode(true)}
              className="bg-red-100 p-2 rounded-lg"
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          ) : (
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={selectAllPlants}
                className="bg-blue-100 px-3 py-2 rounded-lg"
              >
                <Text className="text-blue-600 font-medium text-sm">Todos</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={clearSelection}
                className="bg-gray-100 px-3 py-2 rounded-lg"
              >
                <Text className="text-gray-600 font-medium text-sm">
                  Cancelar
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Selection Mode Info */}
        {isSelectionMode && (
          <View className="bg-red-50 p-3 rounded-lg mb-4 border border-red-200">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Ionicons name="information-circle" size={16} color="#EF4444" />
                <Text className="text-red-700 text-sm ml-2">
                  {selectedPlants.size} planta
                  {selectedPlants.size !== 1 ? "s" : ""} selecionada
                  {selectedPlants.size !== 1 ? "s" : ""}
                </Text>
              </View>
              {selectedPlants.size > 0 && (
                <TouchableOpacity
                  onPress={() => setConfirmDelete(true)}
                  disabled={isDeleting}
                  className="bg-red-500 px-4 py-2 rounded-lg flex-row items-center"
                >
                  {isDeleting ? (
                    <ActivityIndicator
                      size="small"
                      color="white"
                      className="mr-1"
                    />
                  ) : (
                    <Ionicons
                      name="trash"
                      size={16}
                      color="white"
                      className="mr-1"
                    />
                  )}
                  <Text className="text-white font-medium text-sm">
                    {isDeleting ? "Deletando..." : "Deletar"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Search Bar */}
        {!isSelectionMode && (
          <View className="bg-gray-100 rounded-xl px-4 py-3 flex-row items-center mb-4">
            <Ionicons name="search" size={20} color="#6B7280" />
            <TextInput
              placeholder="Buscar plantas..."
              value={searchText}
              onChangeText={setSearchText}
              className="flex-1 ml-3 text-gray-900"
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText("")}>
                <Ionicons name="close-circle" size={20} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Filter Buttons */}
        {!isSelectionMode && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row">
              <TouchableOpacity
                onPress={() => setFilterBy("todos")}
                className={`px-4 py-2 rounded-full mr-3 ${
                  filterBy === "todos" ? "bg-green-500" : "bg-gray-200"
                }`}
              >
                <Text
                  className={`font-medium ${
                    filterBy === "todos" ? "text-white" : "text-gray-700"
                  }`}
                >
                  Todas ({getCountByType("todos")})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setFilterBy("tucunaca")}
                className={`px-4 py-2 rounded-full mr-3 ${
                  filterBy === "tucunaca" ? "bg-green-500" : "bg-gray-200"
                }`}
              >
                <Text
                  className={`font-medium ${
                    filterBy === "tucunaca" ? "text-white" : "text-gray-700"
                  }`}
                >
                  Tucunacá ({getCountByType("tucunaca")})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setFilterBy("caupuri")}
                className={`px-4 py-2 rounded-full mr-3 ${
                  filterBy === "caupuri" ? "bg-green-500" : "bg-gray-200"
                }`}
              >
                <Text
                  className={`font-medium ${
                    filterBy === "caupuri" ? "text-white" : "text-gray-700"
                  }`}
                >
                  Caupuri ({getCountByType("caupuri")})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setFilterBy("chacrona")}
                className={`px-4 py-2 rounded-full ${
                  filterBy === "chacrona" ? "bg-green-500" : "bg-gray-200"
                }`}
              >
                <Text
                  className={`font-medium ${
                    filterBy === "chacrona" ? "text-white" : "text-gray-700"
                  }`}
                >
                  Chacrona ({getCountByType("chacrona")})
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>

      {/* Sync Section */}
      {!isSelectionMode && pendingCount > 0 ? (
        <View className="mx-6 mt-4">
          <TouchableOpacity
            onPress={() => {
              setConfirmSync(true);
            }}
            disabled={isSyncing}
            className={`bg-orange-500 rounded-xl p-4 flex-row items-center justify-center`}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color="white" className="mr-2" />
            ) : (
              <Ionicons name="sync" size={20} color="white" className="mr-2" />
            )}
            <Text className="text-white font-semibold text-base">
              {isSyncing
                ? "Sincronizando..."
                : `Sincronizar ${pendingCount} planta${
                    pendingCount !== 1 ? "s" : ""
                  } offline`}
            </Text>
          </TouchableOpacity>

          {/* Informação adicional */}
          <View className="bg-orange-50 rounded-lg p-3 mt-2 border border-orange-200">
            <View className="flex-row items-center">
              <Ionicons name="information-circle" size={16} color="#EA580C" />
              <Text className="text-orange-700 text-sm ml-2 flex-1">
                {pendingCount} planta
                {pendingCount !== 1 ? "s" : ""} salva
                {pendingCount !== 1 ? "s" : ""} offline. Sincronize para
                enviar ao servidor e ver atualizações.
              </Text>
            </View>
          </View>
        </View>
      ) : (
        !isSelectionMode && (
          <View className="mx-6 mt-4 bg-green-50 p-4 rounded-xl border border-green-200 flex-row items-center">
            <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
            <Text className="ml-2 text-green-700 font-medium">
              Tudo sincronizado! Nenhuma planta offline encontrada.
            </Text>
          </View>
        )
      )}

      {!isSelectionMode && failedCount > 0 && (
        <View className="mx-6 mt-4 bg-red-50 p-3 rounded-xl border border-red-200">
          <Text className="text-red-700 font-semibold mb-2">
            {failedCount} alteraç{failedCount !== 1 ? "ões" : "ão"} com erro de
            sincronização
          </Text>
          {ops
            .filter((o) => o.status === "failed")
            .map((o) => (
              <View key={o.opId} className="mb-2">
                <Text className="text-red-700 text-sm">
                  {o.payload?.name ?? "Exclusão"}: {o.lastError}
                </Text>
                <View className="flex-row gap-4 mt-1">
                  <TouchableOpacity onPress={() => retryOp(o.opId)}>
                    <Text className="text-green-700 font-semibold">
                      Tentar de novo
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => discardOp(o.opId)}>
                    <Text className="text-red-600 font-semibold">Descartar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
        </View>
      )}

      {/* Plants List */}
      <View className="px-6 py-4 flex-1">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-gray-900 text-xl font-bold">
            Plantas{" "}
            {searchText &&
              `(${filteredPlants.length} encontrada${
                filteredPlants.length !== 1 ? "s" : ""
              })`}
          </Text>
        </View>

        <ScrollView
          className="max-h-[50vh]"
          showsVerticalScrollIndicator={false}
        >
          {filteredPlants.length === 0 ? (
            <View className="flex-1 items-center justify-center py-8">
              <Ionicons name="leaf-outline" size={48} color="#9CA3AF" />
              <Text className="text-gray-500 text-lg font-medium mt-4">
                {searchText
                  ? "Nenhuma planta encontrada"
                  : "Nenhuma planta cadastrada"}
              </Text>
              <Text className="text-gray-400 text-center mt-2">
                {searchText
                  ? "Tente ajustar os termos de busca ou filtros"
                  : "Adicione suas primeiras plantas ao sistema"}
              </Text>
            </View>
          ) : (
            filteredPlants.map((plant) => (
              <TouchableOpacity
                key={`${plant.id}-${plant.offline ? "offline" : "online"}`}
                className={`bg-white rounded-xl p-4 mb-3 shadow-sm flex-row items-center ${
                  selectedPlants.has(String(plant.id))
                    ? "border-2 border-red-500"
                    : ""
                }`}
                onPress={() => {
                  if (isSelectionMode) {
                    togglePlantSelection(String(plant.id));
                  } else {
                    router.push(`/authenticated/add-plants/${plant.id}`);
                  }
                }}
              >
                {isSelectionMode && (
                  <View className="mr-3">
                    <View
                      className={`w-6 h-6 rounded-full border-2 ${
                        selectedPlants.has(String(plant.id))
                          ? "bg-red-500 border-red-500"
                          : "border-gray-300"
                      } items-center justify-center`}
                    >
                      {selectedPlants.has(String(plant.id)) && (
                        <Ionicons name="checkmark" size={16} color="white" />
                      )}
                    </View>
                  </View>
                )}

                <Image
                  source={
                    plant.image
                      ? { uri: plant.image }
                      : plantTypes?.find((p) => p.id === plant.typeId)?.name ===
                        "Chacrona"
                      ? require("@/assets/images/plant.png")
                      : require("@/assets/images/vine.jpg")
                  }
                  className="w-16 h-16 rounded-xl mr-4"
                />
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-gray-900 font-semibold text-base">
                      {plant.name}
                    </Text>
                    {plant.offline && (
                      <View className="bg-red-100 px-2 py-1 rounded-md">
                        <Text className="text-red-600 text-[0.525rem] font-medium">
                          OFFLINE
                        </Text>
                      </View>
                    )}
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-gray-600 text-sm">
                      {plant.latitude}
                    </Text>
                    <Text className="text-gray-600 text-sm">
                      {plant.longitude}
                    </Text>
                  </View>
                  <Text className="text-gray-600 text-sm">
                    {plantTypes?.find((p) => p.id === plant.typeId)?.name}
                  </Text>
                </View>
                {!isSelectionMode && (
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

      {/* Confirm Sync Modal */}
      {confirmSync && (
        <CustomModal
          visible={confirmSync}
          icon="checkmark-circle"
          iconColor="green"
          title="Sincronizar Plantas Offline"
          message="Você tem plantas salvas offline. Deseja sincronizá-las com o servidor?"
          actions={[
            {
              text: "Cancelar",
              onPress: () => setConfirmSync(false),
              style: "secondary",
            },
            {
              text: "Confirmar",
              onPress: async () => {
                await syncAllOfflinePlants();
                setConfirmSync(false);
              },
            },
          ]}
        />
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <CustomModal
          visible={confirmDelete}
          icon="trash"
          iconColor="red"
          title="Deletar Plantas"
          message={`Tem certeza que deseja deletar ${
            selectedPlants.size
          } planta${
            selectedPlants.size !== 1 ? "s" : ""
          }? Esta ação não pode ser desfeita.`}
          actions={[
            {
              text: "Cancelar",
              onPress: () => setConfirmDelete(false),
              style: "secondary",
            },
            {
              text: "Deletar",
              onPress: async () => {
                setConfirmDelete(false);
                await deleteSelectedPlants();
              },
            },
          ]}
        />
      )}
    </View>
  );
}
