import { averageCoords, REQUIRED_SAMPLES } from "@/src/utils/gps";
import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_ACCURACY_METERS = 10;

export type GpsStatus =
  | "idle"
  | "denied"
  | "acquiring"
  | "precise"
  | "imprecise";

export interface GpsCoords {
  latitude: number;
  longitude: number;
}

interface Sample extends GpsCoords {
  accuracy: number;
}

interface UseGpsCaptureParams {
  initialCoords?: GpsCoords | null;
  autoStart?: boolean;
}

/**
 * Captura de GPS com média móvel das últimas amostras (mais estável sob
 * dossel/mata) e suporte a ajuste manual do marcador. Nunca trava: expõe as
 * melhores coordenadas possíveis mesmo quando a precisão não atinge o alvo.
 */
export function useGpsCapture({
  initialCoords = null,
  autoStart = true,
}: UseGpsCaptureParams = {}) {
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const samplesRef = useRef<Sample[]>([]);

  const [coords, setCoords] = useState<GpsCoords | null>(initialCoords);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [sampleCount, setSampleCount] = useState(0);
  const [status, setStatus] = useState<GpsStatus>(
    initialCoords ? "precise" : "idle"
  );
  const [isManual, setIsManual] = useState(false);

  const stop = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setIsManual(false);
    samplesRef.current = [];
    setSampleCount(0);
    setAccuracy(null);
    setStatus("acquiring");

    const { status: perm } =
      await Location.requestForegroundPermissionsAsync();
    if (perm !== "granted") {
      setStatus("denied");
      return;
    }

    stop();

    subscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 0,
      },
      (location) => {
        const sample: Sample = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy ?? 999,
        };

        const next = [...samplesRef.current, sample].slice(-REQUIRED_SAMPLES);
        samplesRef.current = next;
        setSampleCount(next.length);
        setCoords(averageCoords(next));

        const bestAccuracy = Math.min(...next.map((s) => s.accuracy));
        setAccuracy(bestAccuracy);

        if (next.length < REQUIRED_SAMPLES) {
          setStatus("acquiring");
        } else {
          setStatus(
            bestAccuracy <= MAX_ACCURACY_METERS ? "precise" : "imprecise"
          );
        }
      }
    );
  }, [stop]);

  /** Override manual (arrastar marcador). Vira a fonte da verdade. */
  const setManualCoords = useCallback(
    (value: GpsCoords) => {
      stop();
      setIsManual(true);
      setAccuracy(null);
      setCoords(value);
      setStatus("precise");
    },
    [stop]
  );

  useEffect(() => {
    if (autoStart && !initialCoords) {
      start();
    }
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    coords,
    accuracy,
    sampleCount,
    status,
    isManual,
    hasFix: coords !== null,
    requiredSamples: REQUIRED_SAMPLES,
    maxAccuracy: MAX_ACCURACY_METERS,
    start,
    stop,
    setManualCoords,
  };
}
