import AsyncStorage from "@react-native-async-storage/async-storage";
import { deletePlantImage } from "./image-storage";
import {
  applyCompletion,
  compact,
  Completion,
  discardOp,
  migrateLegacy,
  nextSendable,
  OutboxOp,
  patchOp,
  resetInFlight,
} from "./outbox-core";

/**
 * Persistência do outbox em AsyncStorage. Todo ler-modificar-gravar passa
 * pelo mutex `locked`, para UI e sync não sobrescreverem um ao outro.
 */
const KEY = "plant_outbox_v1";
const LEGACY_KEY = "offline_plants_v2";

let chain: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn);
  chain = run.catch(() => undefined);
  return run;
}

async function load(): Promise<OutboxOp[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as OutboxOp[]) : [];
}

const save = (ops: OutboxOp[]) => AsyncStorage.setItem(KEY, JSON.stringify(ops));

function mutate(fn: (ops: OutboxOp[]) => OutboxOp[]): Promise<OutboxOp[]> {
  return locked(async () => {
    const next = fn(await load());
    await save(next);
    return next;
  });
}

const dropImages = (uris: string[]) => Promise.all(uris.map(deletePlantImage));

export const readOutbox = () => locked(load);

/** Boot: devolve ops inFlight (app morto no envio) e migra o storage legado. */
export function initOutbox(userId: string | null): Promise<void> {
  return locked(async () => {
    let ops = resetInFlight(await load());
    const legacy = userId ? await AsyncStorage.getItem(LEGACY_KEY) : null;
    if (legacy && userId) {
      ops = [...ops, ...migrateLegacy(JSON.parse(legacy).plants ?? [], userId)];
    }
    await save(ops);
    // Só apaga o legado depois de gravar as ops migradas.
    if (legacy) await AsyncStorage.removeItem(LEGACY_KEY);
  });
}

export async function enqueue(op: OutboxOp): Promise<void> {
  let orphans: string[] = [];
  await mutate((ops) => {
    const result = compact(ops, op);
    orphans = result.orphanImages;
    return result.ops;
  });
  await dropImages(orphans);
}

/** Marca a próxima op enviável como inFlight e a devolve. */
export function takeNext(userId: string): Promise<OutboxOp | undefined> {
  return locked(async () => {
    const ops = await load();
    const op = nextSendable(ops, userId);
    if (!op) return undefined;
    await save(patchOp(ops, op.opId, { status: "inFlight" }));
    return op;
  });
}

export const complete = (opId: string, result?: Completion) =>
  mutate((ops) => applyCompletion(ops, opId, result));

/** Sem rede: volta para a fila. */
export const release = (opId: string) =>
  mutate((ops) =>
    patchOp(ops, opId, (o) => ({ status: "pending", attempts: o.attempts + 1 }))
  );

export const fail = (opId: string, message: string) =>
  mutate((ops) =>
    patchOp(ops, opId, (o) => ({
      status: "failed",
      attempts: o.attempts + 1,
      lastError: message,
    }))
  );

export const retry = (opId: string) =>
  mutate((ops) =>
    patchOp(ops, opId, { status: "pending", attempts: 0, lastError: undefined })
  );

export async function discard(opId: string): Promise<void> {
  let orphans: string[] = [];
  await mutate((ops) => {
    const result = discardOp(ops, opId);
    orphans = result.orphanImages;
    return result.ops;
  });
  await dropImages(orphans);
}
