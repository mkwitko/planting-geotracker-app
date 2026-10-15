import type { PlantFormData } from "@/src/pages/add-plants/add-plants-schema";

const toIso = (value?: Date | string | null): string | undefined =>
  value ? new Date(value).toISOString() : undefined;

/**
 * Converte os dados do formulário/offline no corpo aceito pela API de criação
 * de plantas: datas em ISO e coordenadas numéricas. Fonte única usada tanto no
 * submit online quanto no sync automático de plantas offline.
 */
export function toApiCreateBody(data: PlantFormData) {
  const { id: _id, sync: _sync, ...rest } = data as PlantFormData & { sync?: boolean };
  return {
    ...rest,
    latitude: parseFloat(String(data.latitude)),
    longitude: parseFloat(String(data.longitude)),
    plantationDate: toIso(data.plantationDate),
    pictureDate: toIso(data.pictureDate),
    lastWatering: toIso(data.lastWatering),
    lastFertilization: toIso(data.lastFertilization),
    lastPestControl: toIso(data.lastPestControl),
    lastPruning: toIso(data.lastPruning),
    lastHarvest: toIso(data.lastHarvest),
    lastWeeding: toIso(data.lastWeeding),
    lastSoilAnalysis: toIso(data.lastSoilAnalysis),
  };
}
