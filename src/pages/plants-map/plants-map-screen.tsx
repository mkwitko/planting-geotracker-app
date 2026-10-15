import { useOfflineContext, usePlantsView } from "@/src/context/offline-context";
import { useFindAllPlantsTypes } from "@/src/http/generated/plants-type/plants-type";
import * as Location from "expo-location";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, View } from "react-native";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import { ClusterMarker } from "./components/cluster-marker";
import { MapControls } from "./components/map-controls";
import { MapFilters } from "./components/map-filters";
import { MapTypeName, nextMapType } from "./components/map-type";
import { PlantDetailsSheet } from "./components/plant-details-sheet";
import { PlantMarker } from "./components/plant-marker";
import { useClusters } from "./hooks/use-clusters";
import { useMapPlants } from "./hooks/use-map-plants";
import { MapFilters as Filters, MapPlant, MapRegion } from "./types";

const DEFAULT_REGION: MapRegion = {
  latitude: -23.5505,
  longitude: -46.6333,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

const INITIAL_FILTERS: Filters = {
  typeIds: [],
  showOnline: true,
  showOffline: true,
};

export default function PlantsMapScreen() {
  const { plants } = usePlantsView();
  const { data: plantTypes } = useFindAllPlantsTypes();
  const {
    pendingCount,
    isConnected,
    isSyncing,
    syncNow,
  } = useOfflineContext();

  const mapRef = useRef<MapView>(null);

  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [mapType, setMapType] = useState<MapTypeName>("satellite");
  const [region, setRegion] = useState<MapRegion | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<MapPlant | null>(null);
  const [userLocation, setUserLocation] =
    useState<Location.LocationObject | null>(null);

  const { plants: mapPlants, total, onlineCount, offlineCount, typeCounts } =
    useMapPlants({
      plants,
      plantTypes,
      filters,
    });

  const clusters = useClusters(mapPlants, region);

  // Permissão + posição do usuário (para fallback de região inicial).
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permissão negada",
          "Permissão para acessar localização foi negada"
        );
        return;
      }
      try {
        setUserLocation(await Location.getCurrentPositionAsync({}));
      } catch (error) {
        console.error("Erro ao obter localização:", error);
      }
    })();
  }, []);

  const initialRegion = useMemo<MapRegion>(() => {
    if (mapPlants.length > 0) {
      const lats = mapPlants.map((p) => p.latitude);
      const lngs = mapPlants.map((p) => p.longitude);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max(maxLat - minLat, 0.01) * 1.4,
        longitudeDelta: Math.max(maxLng - minLng, 0.01) * 1.4,
      };
    }
    return userLocation
      ? {
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      }
      : DEFAULT_REGION;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapPlants.length > 0, userLocation]);

  const zoomToCluster = (latitude: number, longitude: number) => {
    const base = region ?? initialRegion;
    mapRef.current?.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta: base.latitudeDelta / 2.5,
        longitudeDelta: base.longitudeDelta / 2.5,
      },
      350
    );
  };

  return (
    <View className="flex-1 bg-gray-100">
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ width: "100%", height: "100%" }}
        mapType={mapType}
        initialRegion={initialRegion}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton
      >
        {clusters.map((item) =>
          item.kind === "cluster" ? (
            <ClusterMarker
              key={item.key}
              latitude={item.latitude}
              longitude={item.longitude}
              count={item.count}
              onPress={() => zoomToCluster(item.latitude, item.longitude)}
            />
          ) : (
            <PlantMarker
              key={item.key}
              plant={item.plant}
              onPress={setSelectedPlant}
            />
          )
        )}
      </MapView>

      <View className="absolute top-4 left-4 flex-row gap-2 items-start">
        <MapFilters
          filters={filters}
          onChange={setFilters}
          typeCounts={typeCounts}
          total={total}
          onlineCount={onlineCount}
          offlineCount={offlineCount}
        />

        <MapControls
          mapType={mapType}
          onCycleMapType={() => setMapType((t) => nextMapType(t))}
          pendingCount={pendingCount}
          isSyncing={isSyncing}
          isConnected={isConnected}
          onSync={syncNow}
        />
      </View>

      {selectedPlant && (
        <PlantDetailsSheet
          plant={selectedPlant}
          onClose={() => setSelectedPlant(null)}
        />
      )}
    </View>
  );
}
