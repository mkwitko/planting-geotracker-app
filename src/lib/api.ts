import Axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  saveSession,
} from "./session";

const API_URL = "https://api.example.com";
const TIMEOUT = 15000;

export const AXIOS_INSTANCE = Axios.create({
  baseURL: process.env.EXPO_PUBLIC_BACKEND || API_URL,
  // Sinal fraco: sem timeout o request pendura e a op nunca volta para a fila.
  timeout: TIMEOUT,
});

// add a second `options` argument here if you want to pass extra options to each generated query
export const customInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig
): Promise<T> => {
  const source = Axios.CancelToken.source();
  const promise = AXIOS_INSTANCE({
    ...config,
    ...options,
    cancelToken: source.token,
  }).then(({ data }) => data);

  // @ts-ignore
  promise.cancel = () => {
    source.cancel("Query was cancelled");
  };

  return promise;
};

AXIOS_INSTANCE.interceptors.request.use(async (config) => {
  try {
    const accessToken = await getAccessToken();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  } catch (error) {
    return Promise.reject(error);
  }
});

// --- Refresh token: fila para evitar múltiplos refresh concorrentes ---
let isRefreshing = false;
let pendingRequests: ((token: string | null) => void)[] = [];

function resolvePending(token: string | null) {
  pendingRequests.forEach((cb) => cb(token));
  pendingRequests = [];
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  // Usa uma instância "crua" (sem interceptors) para não recorrer no 401.
  const { data } = await Axios.post<{
    accessToken: string;
    refreshToken: string;
  }>(
    `${AXIOS_INSTANCE.defaults.baseURL}/authentication/refresh`,
    { refreshToken },
    { timeout: TIMEOUT }
  );

  await saveSession(data.accessToken, data.refreshToken);
  return data.accessToken;
}

AXIOS_INSTANCE.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    // Erro de rede (offline / timeout / sem resposta): NUNCA desloga nem
    // limpa tokens. Apenas propaga para o React Query cair no cache.
    if (!error.response) {
      return Promise.reject(error);
    }

    const status = error.response.status;

    if (status === 401 && original && !original._retry) {
      original._retry = true;

      // Se o próprio refresh deu 401, a sessão morreu de verdade.
      if (original.url?.includes("/authentication/refresh")) {
        await clearSession();
        return Promise.reject(error);
      }

      // Já existe um refresh em andamento: enfileira e aguarda.
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingRequests.push((token) => {
            if (token) {
              original.headers.Authorization = `Bearer ${token}`;
              resolve(AXIOS_INSTANCE(original));
            } else {
              reject(error);
            }
          });
        });
      }

      isRefreshing = true;
      try {
        const newToken = await refreshAccessToken();
        if (!newToken) {
          resolvePending(null);
          await clearSession();
          return Promise.reject(error);
        }

        resolvePending(newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return AXIOS_INSTANCE(original);
      } catch (refreshError) {
        resolvePending(null);
        // Só desloga se o refresh recebeu uma resposta do servidor negando
        // a sessão. Falha de rede no refresh não deve deslogar.
        // @ts-ignore
        const refreshStatus = refreshError?.response?.status;
        // 5xx/timeout no refresh não é sessão negada: não desloga.
        if (refreshStatus === 401 || refreshStatus === 403) {
          await clearSession();
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Mantém o AxiosError (com response.status) para o sync classificar;
    // só troca a mensagem pela do servidor.
    if (error.response?.data?.message) {
      error.message = error.response.data.message;
    }
    return Promise.reject(error);
  }
);
