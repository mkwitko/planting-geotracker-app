import { FindAllPlantsTypes201Item } from "@/src/http/generated/api.schemas";
import { ViewPlant } from "@/src/lib/plants/outbox-core";
import { useMemo } from "react";
import { colorForType } from "../lib/plant-colors";
import { MapFilters, MapPlant } from "../types";

const toNumber = (value: unknown): number => parseFloat(String(value ?? ""));

const isValidCoord = (lat: number, lng: number) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  !(lat === 0 && lng === 0);

interface UseMapPlantsParams {
  plants?: ViewPlant[];
  plantTypes?: FindAllPlantsTypes201Item[];
  filters: MapFilters;
}

export interface TypeCount {
  typeId: string;
  typeName: string;
  color: string;
  count: number;
}

/**
 * Une plantas online e offline em uma lista normalizada (`MapPlant`), atribui
 * cor por tipo, descarta coordenadas inválidas e aplica os filtros ativos.
 */
export function useMapPlants({
  plants: viewPlants,
  plantTypes,
  filters,
}: UseMapPlantsParams) {
  const typeNameById = useMemo(() => {
    const map = new Map<string, string>();
    plantTypes?.forEach((t) => map.set(t.id, t.name));
    return map;
  }, [plantTypes]);

  // Todas as plantas normalizadas, sem filtro (para contagens da legenda).
  const allPlants = useMemo<MapPlant[]>(
    () =>
      (viewPlants ?? [])
        .map((p) => {
          const latitude = toNumber(p.latitude);
          const longitude = toNumber(p.longitude);
          const typeId = p.typeId ?? null;
          return {
            id: p.id,
            name: p.name,
            latitude,
            longitude,
            typeId,
            typeName:
              p.type?.name ?? (typeId ? typeNameById.get(typeId) : "") ?? "Sem tipo",
            color: colorForType(typeId),
            offline: p.offline,
            raw: p,
          };
        })
        .filter((p) => isValidCoord(p.latitude, p.longitude)),
    [viewPlants, typeNameById]
  );

  // Aplica filtros de status e tipo.
  const plants = useMemo(() => {
    return allPlants.filter((p) => {
      if (p.offline && !filters.showOffline) return false;
      if (!p.offline && !filters.showOnline) return false;
      if (filters.typeIds.length > 0) {
        return p.typeId ? filters.typeIds.includes(p.typeId) : false;
      }
      return true;
    });
  }, [allPlants, filters]);

  // Contagem por tipo (sobre o conjunto total, para a legenda/filtro).
  const typeCounts = useMemo<TypeCount[]>(() => {
    const counts = new Map<string, TypeCount>();
    allPlants.forEach((p) => {
      const key = p.typeId ?? "none";
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, {
          typeId: key,
          typeName: p.typeName,
          color: p.color,
          count: 1,
        });
      }
    });
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }, [allPlants]);

  return {
    plants,
    total: plants.length,
    grandTotal: allPlants.length,
    onlineCount: allPlants.filter((p) => !p.offline).length,
    offlineCount: allPlants.filter((p) => p.offline).length,
    typeCounts,
  };
}
