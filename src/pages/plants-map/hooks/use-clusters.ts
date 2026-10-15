import { useMemo } from "react";
import { MapItem, MapPlant, MapRegion } from "../types";

/** Nº de células na horizontal/vertical da área visível. Maior = agrupa menos. */
const GRID = 10;

/**
 * Agrupa plantas próximas em clusters usando uma grade proporcional ao zoom
 * atual (região). Ao dar zoom (deltas menores), as células encolhem e os
 * pontos se separam naturalmente. Sem dependência externa.
 */
export function useClusters(
  plants: MapPlant[],
  region: MapRegion | null
): MapItem[] {
  return useMemo(() => {
    if (!region) {
      return plants.map((plant) => ({
        kind: "point" as const,
        key: plant.id,
        plant,
      }));
    }

    const latStep = region.latitudeDelta / GRID;
    const lngStep = region.longitudeDelta / GRID;

    const buckets = new Map<string, MapPlant[]>();
    for (const plant of plants) {
      const cellLat = Math.round(plant.latitude / latStep);
      const cellLng = Math.round(plant.longitude / lngStep);
      const key = `${cellLat}_${cellLng}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(plant);
      else buckets.set(key, [plant]);
    }

    const items: MapItem[] = [];
    for (const [key, bucket] of buckets) {
      if (bucket.length === 1) {
        items.push({ kind: "point", key: bucket[0].id, plant: bucket[0] });
        continue;
      }

      const latitude =
        bucket.reduce((sum, p) => sum + p.latitude, 0) / bucket.length;
      const longitude =
        bucket.reduce((sum, p) => sum + p.longitude, 0) / bucket.length;

      items.push({
        kind: "cluster",
        key: `cluster_${key}`,
        latitude,
        longitude,
        count: bucket.length,
        plants: bucket,
      });
    }

    return items;
  }, [plants, region]);
}
