import NetInfo from "@react-native-community/netinfo";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState } from "react-native";
import { FindAllPlants201Item } from "../http/generated/api.schemas";
import {
  getFindAllPlantsQueryKey,
  useFindAllPlants,
} from "../http/generated/plants/plants";
import * as outbox from "../lib/plants/outbox";
import {
  applyOutbox,
  isLocalId,
  LOCAL_ID_PREFIX,
  makeOp,
  newId,
  OutboxOp,
} from "../lib/plants/outbox-core";
import { sendOp } from "../lib/plants/sync-op";
import { singleFlight } from "../lib/plants/sync-rules";
import { queryClient } from "../lib/react-query";
import { getSessionUserId, subscribeSession } from "../lib/session";
import { PlantFormData } from "../pages/add-plants/add-plants-schema";

interface OfflineContextProps {
  /** Ops do usuário atual, em ordem de envio. */
  ops: OutboxOp[];
  pendingCount: number;
  failedCount: number;
  isConnected: boolean;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
  savePlant: (data: PlantFormData, plantId?: string) => Promise<void>;
  deletePlant: (plantId: string) => Promise<void>;
  retryOp: (opId: string) => Promise<void>;
  discardOp: (opId: string) => Promise<void>;
}

export const OfflineContext = createContext<OfflineContextProps>(
  {} as OfflineContextProps
);

/** Id local de planta que já subiu vira o id do servidor. */
function resolvePlantId(id: string): string {
  if (!isLocalId(id)) return id;
  const server =
    queryClient.getQueryData<FindAllPlants201Item[]>(getFindAllPlantsQueryKey()) ?? [];
  return server.find((p) => p.offlinePreviousId === id)?.id ?? id;
}

async function requireUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) throw new Error("Sessão expirada. Entre novamente.");
  return userId;
}

export const OfflineContextProvider = ({ children }: { children: ReactNode }) => {
  const [ops, setOps] = useState<OutboxOp[]>([]);
  const [isConnected, setIsConnected] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const refresh = useCallback(async () => {
    const userId = await getSessionUserId();
    const all = await outbox.readOutbox();
    setOps(userId ? all.filter((o) => o.userId === userId) : []);
  }, []);

  /** Envia a fila em ordem. Para ao perder a rede ou a sessão. */
  const syncOnce = useCallback(async (): Promise<void> => {
    setIsSyncing(true);
    let sent = false;
    try {
      for (;;) {
        // Relê o dono a cada op: troca de conta no meio do loop para o envio.
        const userId = await getSessionUserId();
        if (!userId) break;
        const op = await outbox.takeNext(userId);
        if (!op) break;
        const result = await sendOp(op);
        await refresh();
        if (result === "offline" || result === "unauthorized") break;
        sent = true;
      }
    } finally {
      setIsSyncing(false);
    }
    if (sent) {
      queryClient.invalidateQueries({ queryKey: getFindAllPlantsQueryKey() });
    }
  }, [refresh]);

  // Um loop por vez: gatilhos simultâneos (NetInfo + boot) não abrem dois
  // envios da mesma planta fora de ordem.
  const runner = useMemo(() => singleFlight(syncOnce), [syncOnce]);
  const syncNow = runner.call;

  const savePlant = useCallback(
    async (data: PlantFormData, plantId?: string) => {
      const userId = await requireUserId();
      const op = plantId
        ? makeOp("update", resolvePlantId(plantId), userId, data)
        : makeOp("create", newId(LOCAL_ID_PREFIX), userId, data);
      await outbox.enqueue(op);
      await refresh();
      syncNow();
    },
    [refresh, syncNow]
  );

  const deletePlant = useCallback(
    async (plantId: string) => {
      const userId = await requireUserId();
      await outbox.enqueue(makeOp("delete", resolvePlantId(plantId), userId));
      await refresh();
      syncNow();
    },
    [refresh, syncNow]
  );

  const retryOp = useCallback(
    async (opId: string) => {
      await outbox.retry(opId);
      await refresh();
      syncNow();
    },
    [refresh, syncNow]
  );

  const discardOp = useCallback(
    async (opId: string) => {
      await outbox.discard(opId);
      await refresh();
    },
    [refresh]
  );

  // Boot + gatilhos de sync: reconexão, app em foreground, login.
  useEffect(() => {
    let active = true;
    const boot = async () => {
      await outbox.initOutbox(await getSessionUserId());
      if (!active) return;
      await refresh();
      syncNow();
    };
    boot();

    const unsubscribeNet = NetInfo.addEventListener((state) => {
      // isInternetReachable começa null (ainda testando): só false é offline,
      // senão o aviso de offline pisca a cada abertura.
      const connected =
        state.isConnected === true && state.isInternetReachable !== false;
      setIsConnected(connected);
      if (connected) syncNow();
    });
    const appState = AppState.addEventListener("change", (status) => {
      if (status === "active") syncNow();
    });
    // saveSession também emite no refresh de token: durante o sync o boot é
    // pulado para não devolver a op inFlight para a fila.
    const unsubscribeSession = subscribeSession((authed) => {
      if (!authed) setOps([]);
      else if (!runner.isRunning()) boot();
    });

    return () => {
      active = false;
      unsubscribeNet();
      appState.remove();
      unsubscribeSession();
    };
  }, [refresh, syncNow, runner]);

  const pendingCount = ops.filter((o) => o.status !== "failed").length;
  const failedCount = ops.length - pendingCount;

  // Sinal fraco mas "conectado" não dispara NetInfo: tenta de novo sozinho.
  // ponytail: intervalo fixo de 60s; backoff se isso gastar bateria/dados.
  useEffect(() => {
    if (!pendingCount || !isConnected) return;
    const timer = setInterval(syncNow, 60_000);
    return () => clearInterval(timer);
  }, [pendingCount, isConnected, syncNow]);

  return (
    <OfflineContext.Provider
      value={{
        ops,
        pendingCount,
        failedCount,
        isConnected,
        isSyncing,
        syncNow,
        savePlant,
        deletePlant,
        retryOp,
        discardOp,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
};

export const useOfflineContext = () => useContext(OfflineContext);

/** Lista para as telas: cache do servidor + ops pendentes aplicadas. */
export function usePlantsView() {
  const { data } = useFindAllPlants();
  const { ops } = useOfflineContext();
  const plants = useMemo(() => applyOutbox(data ?? [], ops), [data, ops]);
  return { plants, isServerLoaded: data !== undefined };
}
