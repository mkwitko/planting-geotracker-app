import * as SecureStore from "expo-secure-store";
import { decodeUserId } from "./jwt";

/**
 * Fonte única de verdade da sessão. O usuário é considerado "logado"
 * enquanto existir um accessToken armazenado localmente — independente de
 * conectividade. Assim o app não desloga offline.
 *
 * Componentes reagem via `subscribeSession`; api.ts e a tela de login
 * chamam `saveSession` / `clearSession` para mutar o estado.
 */

export const ACCESS_TOKEN_KEY = "accessToken";
export const REFRESH_TOKEN_KEY = "refreshToken";

type Listener = (authenticated: boolean) => void;
const listeners = new Set<Listener>();

export function subscribeSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(authenticated: boolean) {
  listeners.forEach((listener) => listener(authenticated));
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function hasSession(): Promise<boolean> {
  return !!(await getAccessToken());
}

export async function saveSession(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
  ]);
  emit(true);
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
  emit(false);
}

/** Dono das ops offline: userId do accessToken salvo (decode local). */
export async function getSessionUserId(): Promise<string | null> {
  const token = await getAccessToken();
  return token ? decodeUserId(token) : null;
}
