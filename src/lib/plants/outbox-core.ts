import type { FindAllPlants201Item } from "@/src/http/generated/api.schemas";
import type { PlantFormData } from "@/src/pages/add-plants/add-plants-schema";

/**
 * Núcleo puro do outbox (fila de operações offline). Sem imports de React
 * Native para rodar no Node: outbox-core.check.ts.
 */

export type OpKind = "create" | "update" | "delete";
export type OpStatus = "pending" | "inFlight" | "failed";

export interface OutboxOp {
  opId: string;
  kind: OpKind;
  /** create: id local; update/delete: id do servidor ou id local. */
  plantId: string;
  /** Formulário completo (create/update). Após JSON as datas viram string. */
  payload?: PlantFormData;
  userId: string;
  createdAt: string;
  attempts: number;
  status: OpStatus;
  lastError?: string;
}

/** Item exibido nas telas: lista do servidor com as ops aplicadas. */
export type ViewPlant = FindAllPlants201Item & {
  offline: boolean;
  syncError?: string;
};

export type Compacted = { ops: OutboxOp[]; orphanImages: string[] };
export type Completion = {
  serverId?: string;
  image?: { local: string; remote: string };
};

export const LOCAL_ID_PREFIX = "local_";

/** Id gerado no aparelho (inclui o legado "temp_"). */
export const isLocalId = (id: string) =>
  id.startsWith(LOCAL_ID_PREFIX) || id.startsWith("temp_");

/** URI local de arquivo (file://). URLs remotas já foram enviadas. */
export function isLocalImage(uri?: string | null): uri is string {
  return !!uri && uri.startsWith("file://");
}

export const newId = (prefix = "") =>
  `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export function makeOp(
  kind: OpKind,
  plantId: string,
  userId: string,
  payload?: PlantFormData
): OutboxOp {
  return {
    opId: newId("op_"),
    kind,
    plantId,
    payload,
    userId,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: "pending",
  };
}

function localImageOf(op: OutboxOp): string[] {
  const image = op.payload?.image;
  return isLocalImage(image) ? [image] : [];
}

/** Fotos locais que nenhuma op restante usa (podem ser apagadas). */
function unreferenced(images: string[], ops: OutboxOp[]): string[] {
  const used = new Set(ops.flatMap(localImageOf));
  return [...new Set(images)].filter((uri) => !used.has(uri));
}

/**
 * Enfileira `op` compactando com as ops pendentes da mesma planta. Ops
 * `inFlight` nunca são alteradas: a nova op entra no fim da fila.
 */
export function compact(ops: OutboxOp[], op: OutboxOp): Compacted {
  const idle = (o: OutboxOp) =>
    o.plantId === op.plantId && o.status !== "inFlight";

  if (op.kind === "create") return { ops: [...ops, op], orphanImages: [] };

  if (op.kind === "update") {
    const target = ops.find((o) => idle(o) && o.kind !== "delete");
    if (!target) return { ops: [...ops, op], orphanImages: [] };
    const next = ops.map(
      (o): OutboxOp =>
        o === target
          ? { ...o, payload: op.payload, status: "pending", attempts: 0, lastError: undefined }
          : o
    );
    return { ops: next, orphanImages: unreferenced(localImageOf(target), next) };
  }

  // delete
  if (ops.some((o) => o.plantId === op.plantId && o.kind === "delete")) {
    return { ops, orphanImages: [] };
  }
  // Create que já saiu para a rede (resposta pode ter se perdido) fica: o
  // servidor pode ter a planta, então o delete precisa ir depois do upsert.
  const maybeOnServer = (o: OutboxOp) =>
    o.kind === "create" && o.attempts > 0 && o.status !== "failed";
  const dropped = ops.filter((o) => idle(o) && !maybeOnServer(o));
  const kept = ops.filter((o) => !dropped.includes(o));
  const droppedCreate = dropped.some((o) => o.kind === "create");
  const next = droppedCreate ? kept : [...kept, op];
  return { ops: next, orphanImages: unreferenced(dropped.flatMap(localImageOf), next) };
}

/** Remove uma op (ação "Descartar"). Descartar um create leva as ops dependentes. */
export function discardOp(ops: OutboxOp[], opId: string): Compacted {
  const op = ops.find((o) => o.opId === opId);
  if (!op) return { ops, orphanImages: [] };
  const dropped =
    op.kind === "create" ? ops.filter((o) => o.plantId === op.plantId) : [op];
  const next = ops.filter((o) => !dropped.includes(o));
  return { ops: next, orphanImages: unreferenced(dropped.flatMap(localImageOf), next) };
}

/**
 * Remove a op enviada. Create: troca o id local pelo do servidor nas ops
 * restantes. Foto enviada: troca a URI local pela URL remota nas ops restantes.
 */
export function applyCompletion(
  ops: OutboxOp[],
  opId: string,
  result: Completion = {}
): OutboxOp[] {
  const done = ops.find((o) => o.opId === opId);
  return ops
    .filter((o) => o.opId !== opId)
    .map((o) => {
      let next = o;
      if (done?.kind === "create" && result.serverId && o.plantId === done.plantId) {
        next = { ...next, plantId: result.serverId };
      }
      if (result.image && next.payload?.image === result.image.local) {
        next = { ...next, payload: { ...next.payload, image: result.image.remote } };
      }
      return next;
    });
}

export function patchOp(
  ops: OutboxOp[],
  opId: string,
  patch: Partial<OutboxOp> | ((o: OutboxOp) => Partial<OutboxOp>)
): OutboxOp[] {
  return ops.map((o) =>
    o.opId === opId ? { ...o, ...(typeof patch === "function" ? patch(o) : patch) } : o
  );
}

/** Boot: op que estava sendo enviada quando o app morreu volta para a fila. */
export const resetInFlight = (ops: OutboxOp[]): OutboxOp[] =>
  ops.map((o) => (o.status === "inFlight" ? { ...o, status: "pending" } : o));

/**
 * Próxima op a enviar (FIFO). Só do usuário atual. Update/delete com id local
 * esperam o create correspondente virar id do servidor.
 */
export function nextSendable(ops: OutboxOp[], userId: string): OutboxOp | undefined {
  return ops.find(
    (o) =>
      o.userId === userId &&
      o.status === "pending" &&
      (o.kind === "create" || !isLocalId(o.plantId))
  );
}

function payloadToFields(payload: PlantFormData): Partial<FindAllPlants201Item> {
  const { id: _id, sync: _sync, ...rest } = payload as PlantFormData & { sync?: boolean };
  return {
    ...rest,
    latitude: parseFloat(String(payload.latitude)),
    longitude: parseFloat(String(payload.longitude)),
    // type desatualizado some; as telas caem no nome pelo typeId.
    type: undefined,
    center: { id: payload.centerId, name: "", region: "" },
  } as unknown as Partial<FindAllPlants201Item>;
}

/** Lista para as telas: servidor + ops aplicadas em ordem. */
export function applyOutbox(
  server: FindAllPlants201Item[],
  ops: OutboxOp[]
): ViewPlant[] {
  let list: ViewPlant[] = server.map((p) => ({ ...p, offline: false }));

  for (const op of ops) {
    if (op.kind === "delete") {
      list = list.filter((p) => p.id !== op.plantId);
      continue;
    }
    if (!op.payload) continue;

    const syncError =
      op.status === "failed" ? op.lastError ?? "Erro ao sincronizar" : undefined;
    // Create cuja resposta se perdeu já está no servidor com offlinePreviousId.
    const i = list.findIndex(
      (p) =>
        p.id === op.plantId ||
        (op.kind === "create" && p.offlinePreviousId === op.plantId)
    );
    const item = {
      ...(i >= 0 ? list[i] : {}),
      ...payloadToFields(op.payload),
      id: i >= 0 ? list[i].id : op.plantId,
      offline: true,
      syncError,
    } as ViewPlant;

    if (i >= 0) list[i] = item;
    else list.push(item);
  }

  return list;
}

/** Converte o storage legado (`offline_plants_v2`) em ops create. */
export function migrateLegacy(
  plants: (PlantFormData & { sync?: boolean })[],
  userId: string
): OutboxOp[] {
  return plants
    .filter((p) => p.sync)
    .map(({ sync: _sync, ...p }) =>
      makeOp("create", p.id || newId(LOCAL_ID_PREFIX), userId, p)
    );
}
