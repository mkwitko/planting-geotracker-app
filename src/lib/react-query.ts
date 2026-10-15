import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";

export const queryClient = new QueryClient({
  queryCache: new QueryCache(),
  defaultOptions: {
    queries: {
      // Dados de referência (tipos de planta, usuário, lista) continuam
      // "frescos" por bastante tempo para servirem offline sem refetch.
      staleTime: 1000 * 60 * 60, // 1h
      gcTime: 1000 * 60 * 60 * 24 * 30, // 30 dias — cobre períodos longos sem sinal
      // networkMode "offlineFirst": tenta a rede, mas se falhar usa o cache
      // em vez de ficar em erro/loading eterno.
      networkMode: "offlineFirst",
      retry: 2,
      refetchOnReconnect: true,
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  },
});

// Persiste o cache do React Query em AsyncStorage. Assim, após a primeira
// carga com internet, tipos de planta / usuário / lista de plantas ficam
// disponíveis offline mesmo após reiniciar o app.
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "REACT_QUERY_OFFLINE_CACHE",
  throttleTime: 1000,
});

export const persistOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
  persister: asyncStoragePersister,
  maxAge: 1000 * 60 * 60 * 24 * 30, // 30 dias
};
