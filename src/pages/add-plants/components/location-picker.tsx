import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import { Control, Controller } from "react-hook-form";
import {
  ActivityIndicator,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Circle, Marker } from "react-native-maps";
import { PlantFormData } from "../add-plants-schema";

interface LocationPickerProps {
  control: Control<PlantFormData>;
  latitudeName: keyof PlantFormData;
  longitudeName: keyof PlantFormData;
}

const MAX_ACCURACY_METERS = 10;

export const LocationPicker: React.FC<LocationPickerProps> = ({
  control,
  latitudeName,
  longitudeName,
}) => {
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const mapRef = useRef<MapView>(null);

  const [loading, setLoading] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);

  const [coords, setCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);

  const isPrecise =
    coords?.accuracy !== undefined && coords.accuracy <= MAX_ACCURACY_METERS;

  useEffect(() => {
    return () => {
      subscriptionRef.current?.remove();
    };
  }, []);

  const startWatching = async (
    onLatChange: (v: string) => void,
    onLngChange: (v: string) => void,
  ) => {
    setLoading(true);

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setLoading(false);
      return;
    }

    subscriptionRef.current?.remove();

    subscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 0,
      },
      (location) => {
        const accuracy = location.coords.accuracy ?? 999;
        const latitude = location.coords.latitude;
        const longitude = location.coords.longitude;

        setCoords({ latitude, longitude, accuracy });

        onLatChange(latitude.toString());
        onLngChange(longitude.toString());

        mapRef.current?.animateCamera(
          {
            center: { latitude, longitude },
            zoom: 19,
          },
          { duration: 500 },
        );

        setLoading(false);
      },
    );
  };

  const confirmLocation = (
    onLatChange: (v: string) => void,
    onLngChange: (v: string) => void,
  ) => {
    if (!coords || !isPrecise) return;

    onLatChange(coords.latitude.toString());
    onLngChange(coords.longitude.toString());
    setShowMapModal(false);
  };

  return (
    <View>
      <Controller
        control={control}
        name={latitudeName}
        render={({ field: { value: lat, onChange: onLatChange } }) => (
          <Controller
            control={control}
            name={longitudeName}
            render={({ field: { value: lng, onChange: onLngChange } }) => (
              <>
                {/* LINHA ÚNICA */}
                <View className="flex-row items-center gap-2 mb-2">
                  <TextInput
                    value={(lat as string) || ""}
                    editable={false}
                    placeholder="Latitude"
                    className="flex-1 bg-white rounded-xl px-4 py-3 border border-gray-200 text-gray-900"
                  />

                  <TextInput
                    value={(lng as string) || ""}
                    editable={false}
                    placeholder="Longitude"
                    className="flex-1 bg-white rounded-xl px-4 py-3 border border-gray-200 text-gray-900"
                  />

                  <TouchableOpacity
                    onPress={() => startWatching(onLatChange, onLngChange)}
                    disabled={loading}
                    className="h-11 w-11 items-center justify-center rounded-xl bg-green-500"
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Ionicons name="location" size={18} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>

                {/* PRECISÃO */}
                {coords && (
                  <Text
                    className={`text-xs text-center ${
                      isPrecise ? "text-green-600" : "text-amber-600"
                    }`}
                  >
                    {isPrecise
                      ? `Precisão máxima atingida (${coords.accuracy.toFixed(
                          1,
                        )}m)`
                      : `Precisão atual: ±${coords.accuracy.toFixed(
                          1,
                        )}m — aguarde ≤ ${MAX_ACCURACY_METERS}m`}
                  </Text>
                )}

                {/* BOTÃO ABRIR MAPA */}
                {coords && (
                  <TouchableOpacity
                    onPress={() => setShowMapModal(true)}
                    className="mt-2 self-center"
                  >
                    <Text className="text-sm text-blue-600">Ver no mapa</Text>
                  </TouchableOpacity>
                )}

                {/* MODAL MAPA */}
                <Modal visible={showMapModal} animationType="slide">
                  <View className="flex-1 bg-white">
                    <View className="flex-row justify-between items-center px-4 py-3 border-b">
                      <Text className="font-semibold text-lg">
                        Localização precisa
                      </Text>

                      <TouchableOpacity
                        disabled={!isPrecise}
                        onPress={() =>
                          confirmLocation(onLatChange, onLngChange)
                        }
                        className={`px-4 py-2 rounded-full ${
                          isPrecise ? "bg-green-500" : "bg-gray-300"
                        }`}
                      >
                        <Text className="text-white font-semibold">
                          Confirmar
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {coords && (
                      <MapView
                        ref={mapRef}
                        style={{ flex: 1 }}
                        mapType="satellite"
                        initialCamera={{
                          center: coords,
                          zoom: 20,
                          pitch: 0,
                          heading: 0,
                          altitude: 0,
                        }}
                      >
                        {!isPrecise && (
                          <Circle
                            center={coords}
                            radius={coords.accuracy}
                            strokeColor="rgba(245,158,11,0.6)"
                            fillColor="rgba(245,158,11,0.2)"
                          />
                        )}

                        <Marker coordinate={coords} />
                      </MapView>
                    )}

                    <View className="p-3 border-t">
                      <Text
                        className={`text-center text-sm ${
                          isPrecise ? "text-green-600" : "text-gray-600"
                        }`}
                      >
                        {isPrecise
                          ? "Precisão no máximo possível. Pode confirmar."
                          : `Aguardando precisão ≤ ${MAX_ACCURACY_METERS}m`}
                      </Text>
                    </View>
                  </View>
                </Modal>
              </>
            )}
          />
        )}
      />
    </View>
  );
};
