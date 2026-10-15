import React, { useEffect, useRef } from "react";
import MapView, { Circle, Marker } from "react-native-maps";
import { GpsCoords } from "../hooks/use-gps-capture";

interface LocationMapProps {
  coords: GpsCoords;
  accuracy: number | null;
  showAccuracyCircle: boolean;
  onMarkerDrag: (coords: GpsCoords) => void;
}

/**
 * Mapa satélite com marcador arrastável. Arrastar sobrescreve a posição
 * capturada (fallback quando o GPS está fraco sob mata).
 */
export const LocationMap: React.FC<LocationMapProps> = ({
  coords,
  accuracy,
  showAccuracyCircle,
  onMarkerDrag,
}) => {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    mapRef.current?.animateCamera(
      { center: coords, zoom: 19 },
      { duration: 500 }
    );
  }, [coords]);

  return (
    <MapView
      ref={mapRef}
      style={{ flex: 1 }}
      mapType="satellite"
      initialCamera={{
        center: coords,
        zoom: 19,
        pitch: 0,
        heading: 0,
        altitude: 0,
      }}
    >
      {showAccuracyCircle && accuracy !== null && (
        <Circle
          center={coords}
          radius={accuracy}
          strokeColor="rgba(245,158,11,0.6)"
          fillColor="rgba(245,158,11,0.2)"
        />
      )}

      <Marker
        coordinate={coords}
        draggable
        onDragEnd={(e) => onMarkerDrag(e.nativeEvent.coordinate)}
      />
    </MapView>
  );
};
