import Axios from "axios";
import type { OpKind } from "./outbox-core";

/**
 * Regras puras do sync (sem React Native), testadas em sync-rules.check.ts.
 */

/** Foto sumiu do aparelho: erro permanente (não adianta tentar de novo). */
export class MissingImageError extends Error {
  constructor() {
    super("Foto não encontrada no aparelho.");
    this.name = "MissingImageError";
  }
}

export type ErrorAction = "release" | "unauthorized" | "notFound" | "fail";

/** O que fazer com a op após um erro de envio. */
export function classifyError(error: unknown): ErrorAction {
  if (Axios.isAxiosError(error)) {
    const status = error.response?.status;
    // Sem resposta (sem rede/timeout) ou servidor/proxy fora: tenta depois.
    if (!status || status >= 500) return "release";
    if (status === 401) return "unauthorized";
    if (status === 404) return "notFound";
    return "fail";
  }
  // Upload nativo (FileSystem) sem rede ou 5xx do R2: tenta depois.
  return error instanceof MissingImageError ? "fail" : "release";
}

/**
 * Sobe a foto local. No update, foto local já apagada (formulário aberto antes
 * do create subir) devolve undefined: o servidor mantém a foto que já tem.
 */
export async function uploadOrKeep(
  kind: OpKind,
  localImage: string,
  upload: (uri: string) => Promise<string>
): Promise<string | undefined> {
  try {
    return await upload(localImage);
  } catch (error) {
    if (error instanceof MissingImageError && kind === "update") return undefined;
    throw error;
  }
}

/**
 * Uma execução por vez. Chamadas durante a execução não abrem outra: viram
 * uma única rodada extra no fim (pega ops enfileiradas no meio).
 */
export function singleFlight(run: () => Promise<void>) {
  let running = false;
  let rerun = false;

  const call = async (): Promise<void> => {
    if (running) {
      rerun = true;
      return;
    }
    running = true;
    try {
      await run();
    } finally {
      running = false;
    }
    if (rerun) {
      rerun = false;
      return call();
    }
  };

  return { call, isRunning: () => running };
}
