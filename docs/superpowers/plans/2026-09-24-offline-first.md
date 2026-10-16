# Offline-first Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create, edit and delete plants fully offline through a persisted operation queue (outbox) that syncs idempotently, and fix the auth issues that break sessions and security.

**Architecture:** Every plant write becomes an `OutboxOp` in AsyncStorage (pure logic in `outbox-core.ts`, persistence and mutex in `outbox.ts`, network in `sync-op.ts`). `OfflineContext` runs the sync loop and exposes `usePlantsView()` = server cache + pending ops. Backend gains an idempotent create (upsert by `offlinePreviousId`), 404 on missing records, verified refresh tokens and `Authorization: Bearer` support.

**Tech Stack:** Expo 53 / React Native 0.79, TanStack Query 5 (persisted), AsyncStorage, axios, orval-generated client; Fastify 5 + Prisma 6 + vitest on the backend.

**Spec:** `docs/superpowers/specs/2026-09-24-offline-first-design.md`

## Global Constraints

- Repos: app = `planting-geotracker-app/`, backend = `planting-geotracker-api/` (siblings under `planting-geotracker/`). Each is its own git repo.
- No new dependencies in either repo.
- Outbox storage key: `plant_outbox_v1`. Legacy key to migrate: `offline_plants_v2`.
- Local plant ids: prefix `local_` (legacy `temp_` also counts as local).
- Axios timeout: `15000` ms.
- Cache: `gcTime` and `persistOptions.maxAge` = 30 days.
- User-facing text in Portuguese (pt-BR), matching existing copy.
- App typecheck baseline: `npx tsc --noEmit` currently reports 6 errors (skeleton.tsx, text.tsx, plant-convertion.ts). Do not add new ones.
- Backend typecheck has pre-existing errors (sign-out.ts, plants-type services). Do not add new ones.

## Review Focus

1. User edits a plant while its create op is being sent: the edit must survive (op appended, local id rewritten after create). Covered in Task 3 check.
2. The POST reaches the server but the response is lost, and the user edits again before the retry: no duplicate, latest data wins (backend upsert). Covered in Task 2 test and Task 3 check (`applyOutbox` merges by `offlinePreviousId`).
3. A photo shared between a completed create and a later update: the update must upload the remote URL, not a deleted local file. Covered in Task 3 check (`applyCompletion` rewrites image).
4. Another user logs in on the same device: they must not see or send the previous user's ops. Covered by `nextSendable` userId filter (Task 3 check) and context filtering (Task 5).
5. App killed while an op is `inFlight`: on boot it goes back to `pending`. Covered in Task 3 check (`resetInFlight`).

---

### Task 1: Backend auth — verified refresh, refresh route without middleware, Bearer header

**Files:**
- Modify: `planting-geotracker-api/src/api/v1/services/authentication/refresh-token-service.ts`
- Modify: `planting-geotracker-api/src/api/v1/controllers/authentication/refresh-token.ts`
- Modify: `planting-geotracker-api/src/middlewares/authentication-middleware.ts`

**Interfaces:**
- Produces: `POST /authentication/refresh` accepts `{ refreshToken }` with no cookie or header. Any authenticated route accepts `Authorization: Bearer <accessToken>`, with the cookie as fallback.

- [ ] **Step 1: Verify the refresh token signature**

In `refresh-token-service.ts` replace the decode line:

```ts
  const decode = app.jwt.decode<FastifyJWT["payload"]>(refreshToken);
```

with:

```ts
  // verify (não decode): o token do body precisa ter assinatura válida,
  // senão qualquer um forjaria um userId e receberia tokens de outra conta.
  const decode = await app.jwt.verify<FastifyJWT["payload"]>(refreshToken);
```

- [ ] **Step 2: Remove the middleware from the refresh route**

In `refresh-token.ts` delete the import `import { authenticationMiddleware } from "@/middlewares/authentication-middleware";` and the line `.register(authenticationMiddleware)`. The chain becomes:

```ts
  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      "/authentication/refresh",
```

- [ ] **Step 3: Accept the Bearer header in the middleware**

In `authentication-middleware.ts` replace:

```ts
        // Extract the access token from cookies
        const accessToken = request.cookies.accessToken;
```

with:

```ts
        // App mobile envia Bearer (tokens no SecureStore); web usa cookie.
        const header = request.headers.authorization;
        const accessToken = header?.startsWith("Bearer ")
          ? header.slice(7)
          : request.cookies.accessToken;
```

- [ ] **Step 4: Typecheck**

Run: `cd planting-geotracker-api && npx tsc --noEmit 2>&1 | grep -E "refresh-token|authentication-middleware"`
Expected: no output.

- [ ] **Step 5: Manual check (only if a local DB and `.env` are available)**

Run `yarn dev`, then:

```bash
# forged token (garbage signature) -> 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:$PORT/authentication/refresh \
  -H 'content-type: application/json' \
  -d '{"refreshToken":"<forged-token>"}'
```

Expected: `401`. Then sign in, take `accessToken` from the response body and call `curl -H "Authorization: Bearer <token>" localhost:$PORT/user/find/me`. Expected: 200 with no cookie. If no local DB is available, record "manual check skipped" in the task report.

- [ ] **Step 6: Commit**

```bash
cd planting-geotracker-api
git add src/api/v1/services/authentication/refresh-token-service.ts src/api/v1/controllers/authentication/refresh-token.ts src/middlewares/authentication-middleware.ts
git commit -m "fix(auth): verify refresh token, accept Bearer header"
```

---

### Task 2: Backend — idempotent create and 404 for missing records

**Files:**
- Create: `planting-geotracker-api/src/errors/not-found-error.ts`
- Modify: `planting-geotracker-api/src/lib/prisma/prisma.ts`
- Modify: `planting-geotracker-api/src/error-handler.ts`
- Modify: `planting-geotracker-api/src/api/v1/models/plants-model.ts:23-29`
- Test: `planting-geotracker-api/src/api/v1/models/plants-model.test.ts`

**Interfaces:**
- Produces: `POST /plants/create` with `offlinePreviousId` upserts by that field and returns 201 with the plant. `PUT /plant/update` and `DELETE /plants/delete` on a missing id return 404.

- [ ] **Step 1: Write the failing test**

`src/api/v1/models/plants-model.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { upsert, create } = vi.hoisted(() => ({
  upsert: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/lib/prisma/prisma", () => ({ prisma: { plants: { upsert, create } } }));

import { PlantsModel } from "./plants-model";

const base = {
  name: "Planta",
  latitude: -10,
  longitude: -50,
  typeId: "t1",
  centerId: "c1",
};

describe("PlantsModel.create", () => {
  beforeEach(() => {
    upsert.mockReset().mockResolvedValue({ id: "p1" });
    create.mockReset().mockResolvedValue({ id: "p2" });
  });

  it("upserts by offlinePreviousId so a resend does not duplicate", async () => {
    await new PlantsModel().create({ ...base, offlinePreviousId: "local_1" });
    expect(create).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { offlinePreviousId: "local_1" },
        create: expect.objectContaining({ name: "Planta" }),
        update: expect.objectContaining({ name: "Planta" }),
      })
    );
  });

  it("creates normally without offlinePreviousId", async () => {
    await new PlantsModel().create(base);
    expect(upsert).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd planting-geotracker-api && npx vitest run src/api/v1/models/plants-model.test.ts`
Expected: FAIL. The first test fails because `create` was called instead of `upsert`.

- [ ] **Step 3: Implement the upsert**

In `plants-model.ts` replace the `create` method:

```ts
  async create(data: z.infer<typeof createPlantRequestSchema>) {
    // Idempotente: o app reenvia o create quando a resposta se perde (sinal
    // fraco). O upsert pelo id local evita duplicar e aplica o payload mais
    // recente.
    if (data.offlinePreviousId) {
      return prisma.plants.upsert({
        where: { offlinePreviousId: data.offlinePreviousId },
        create: data,
        update: data,
        include,
      });
    }

    const plant = await prisma.plants.create({
      data,
      include,
    });
    return plant;
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/api/v1/models/plants-model.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Map P2025 to 404**

Create `src/errors/not-found-error.ts`:

```ts
export class NotFoundError extends Error {
  constructor(message?: string) {
    super(message ?? "Não encontrado");
    this.name = "NotFoundError";
  }
}
```

In `src/lib/prisma/prisma.ts` add `import { NotFoundError } from "@/errors/not-found-error";` and replace the catch body:

```ts
        } catch (error: any) {
          const errorMessage = handlePrismaError(error);
          // Registro inexistente (update/delete/findUniqueOrThrow): 404 para o
          // app distinguir de erro real.
          if (error?.code === "P2025") throw new NotFoundError(errorMessage);
          throw new Error(errorMessage);
        }
```

In `src/error-handler.ts` add `import { NotFoundError } from "./errors/not-found-error";` and, right before the `if (error instanceof ConflictError)` block:

```ts
  if (error instanceof NotFoundError) {
    return reply.status(404).send({
      message: error.message,
    });
  }
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "plants-model|prisma.ts|error-handler|not-found"`
Expected: no output. If `upsert` complains about `create: data` or `update: data` typing, cast the same way `prisma.plants.create({ data })` accepts it. Do not change the zod schema.

- [ ] **Step 7: Commit**

```bash
git add src/errors/not-found-error.ts src/lib/prisma/prisma.ts src/error-handler.ts src/api/v1/models/plants-model.ts src/api/v1/models/plants-model.test.ts
git commit -m "feat(plants): idempotent create by offlinePreviousId, 404 on missing"
```

---

### Task 3: App — pure outbox core + JWT decode, with self-check

**Files:**
- Create: `planting-geotracker-app/src/lib/plants/outbox-core.ts`
- Create: `planting-geotracker-app/src/lib/jwt.ts`
- Test: `planting-geotracker-app/src/lib/plants/outbox-core.check.ts`

**Interfaces:**
- Produces (all exported from `outbox-core.ts`):
  - types `OpKind`, `OpStatus`, `OutboxOp`, `ViewPlant`, `Compacted = { ops: OutboxOp[]; orphanImages: string[] }`, `Completion = { serverId?: string; image?: { local: string; remote: string } }`
  - `LOCAL_ID_PREFIX = "local_"`, `isLocalId(id: string): boolean`, `isLocalImage(uri?: string | null): uri is string`, `newId(prefix?: string): string`
  - `makeOp(kind, plantId, userId, payload?): OutboxOp`
  - `compact(ops, op): Compacted`
  - `discardOp(ops, opId): Compacted`
  - `applyCompletion(ops, opId, result?: Completion): OutboxOp[]`
  - `patchOp(ops, opId, patch: Partial<OutboxOp> | ((o: OutboxOp) => Partial<OutboxOp>)): OutboxOp[]`
  - `resetInFlight(ops): OutboxOp[]`
  - `nextSendable(ops, userId): OutboxOp | undefined`
  - `applyOutbox(server: FindAllPlants201Item[], ops): ViewPlant[]`
  - `migrateLegacy(plants: (PlantFormData & { sync?: boolean })[], userId): OutboxOp[]`
- `jwt.ts`: `decodeUserId(token: string): string | null`

- [ ] **Step 1: Write the failing check**

`src/lib/plants/outbox-core.check.ts`:

```ts
// Self-check do núcleo do outbox. Rodar: npx tsx src/lib/plants/outbox-core.check.ts
import assert from "node:assert/strict";
import { decodeUserId } from "../jwt";
import {
  applyCompletion,
  applyOutbox,
  compact,
  discardOp,
  isLocalId,
  makeOp,
  migrateLegacy,
  nextSendable,
  OutboxOp,
  resetInFlight,
} from "./outbox-core";

const U = "user1";
const form = (over: Record<string, unknown> = {}) =>
  ({
    name: "A",
    latitude: "-10.5",
    longitude: "-50.1",
    centerId: "c1",
    typeId: "t1",
    ...over,
  }) as any;
const server = (id: string, over: Record<string, unknown> = {}) =>
  ({ id, offlinePreviousId: null, name: "S", latitude: 1, longitude: 2, typeId: "t1", ...over }) as any;
const flying = (op: OutboxOp): OutboxOp => ({ ...op, status: "inFlight" });

// create appends
let r = compact([], makeOp("create", "local_1", U, form()));
assert.equal(r.ops.length, 1);

// update on a pending create replaces the create payload
r = compact(r.ops, makeOp("update", "local_1", U, form({ name: "B" })));
assert.equal(r.ops.length, 1);
assert.equal(r.ops[0].kind, "create");
assert.equal(r.ops[0].payload?.name, "B");

// update on a pending update replaces the payload
let u = compact([], makeOp("update", "s1", U, form({ name: "X" })));
u = compact(u.ops, makeOp("update", "s1", U, form({ name: "Y" })));
assert.equal(u.ops.length, 1);
assert.equal(u.ops[0].payload?.name, "Y");

// update with no pending op appends
assert.equal(compact([], makeOp("update", "s2", U, form())).ops.length, 1);

// update on a failed op resets it to pending
const failed: OutboxOp = { ...makeOp("update", "s3", U, form()), status: "failed", lastError: "x" };
const fixed = compact([failed], makeOp("update", "s3", U, form({ name: "ok" })));
assert.equal(fixed.ops[0].status, "pending");
assert.equal(fixed.ops[0].lastError, undefined);

// update replacing a local photo reports the old one as orphan
const photo = compact([], makeOp("create", "local_p", U, form({ image: "file:///old.jpg" })));
assert.deepEqual(
  compact(photo.ops, makeOp("update", "local_p", U, form({ image: "file:///new.jpg" }))).orphanImages,
  ["file:///old.jpg"]
);

// delete on a pending create drops everything and orphans the photo
const del = compact(photo.ops, makeOp("delete", "local_p", U));
assert.equal(del.ops.length, 0);
assert.deepEqual(del.orphanImages, ["file:///old.jpg"]);

// delete on a pending update replaces it with a delete
const d2 = compact(u.ops, makeOp("delete", "s1", U));
assert.equal(d2.ops.length, 1);
assert.equal(d2.ops[0].kind, "delete");

// a duplicate delete is ignored
assert.equal(compact(d2.ops, makeOp("delete", "s1", U)).ops.length, 1);

// an inFlight op is never changed: the update is appended
const sending = [flying(makeOp("create", "local_3", U, form()))];
const f = compact(sending, makeOp("update", "local_3", U, form({ name: "Z" })));
assert.equal(f.ops.length, 2);
assert.equal(f.ops[0].payload?.name, "A");

// an update for a local id waits for its create; other users' ops are never sent
assert.equal(nextSendable(f.ops, U), undefined);
assert.equal(nextSendable([makeOp("create", "local_9", "other", form())], U), undefined);

// completion of a create rewrites the local id and the local photo in later ops
const pair: OutboxOp[] = [
  flying(makeOp("create", "local_4", U, form({ image: "file:///a.jpg" }))),
  makeOp("update", "local_4", U, form({ image: "file:///a.jpg" })),
];
const after = applyCompletion(pair, pair[0].opId, {
  serverId: "srv4",
  image: { local: "file:///a.jpg", remote: "https://r2/a.jpg" },
});
assert.equal(after.length, 1);
assert.equal(after[0].plantId, "srv4");
assert.equal(after[0].payload?.image, "https://r2/a.jpg");
assert.equal(nextSendable(after, U)?.opId, after[0].opId);

// discarding an op keeps a photo still used by another op
assert.deepEqual(discardOp(pair, pair[1].opId).orphanImages, []);
// discarding a create also drops its dependent ops
const dc = discardOp(pair, pair[0].opId);
assert.equal(dc.ops.length, 0);
assert.deepEqual(dc.orphanImages, ["file:///a.jpg"]);

// applyOutbox: update, delete, new create, create already on the server (lost response)
const view = applyOutbox(
  [server("s1"), server("s2"), server("s5", { offlinePreviousId: "local_5" })],
  [
    makeOp("update", "s1", U, form({ name: "Edit" })),
    makeOp("delete", "s2", U),
    makeOp("create", "local_6", U, form({ name: "Novo" })),
    makeOp("create", "local_5", U, form({ name: "Dup" })),
  ]
);
assert.deepEqual(view.map((p) => p.id), ["s1", "s5", "local_6"]);
assert.equal(view[0].name, "Edit");
assert.equal(view[0].latitude, -10.5);
assert.equal(view[0].offline, true);
assert.equal(view[1].name, "Dup");
assert.equal(view[2].offline, true);

// a failed op shows its error
const withError = applyOutbox([], [
  { ...makeOp("create", "local_7", U, form()), status: "failed", lastError: "boom" },
]);
assert.equal(withError[0].syncError, "boom");

// boot: an inFlight op goes back to pending
assert.equal(resetInFlight(sending)[0].status, "pending");

// legacy migration keeps only pending plants and drops the sync flag
const migrated = migrateLegacy(
  [
    { ...form(), id: "temp_1", sync: true },
    { ...form(), id: "x", sync: false },
  ],
  U
);
assert.equal(migrated.length, 1);
assert.equal(migrated[0].plantId, "temp_1");
assert.equal(migrated[0].kind, "create");
assert.equal("sync" in (migrated[0].payload as object), false);
assert.equal(isLocalId("temp_1"), true);
assert.equal(isLocalId("cm123"), false);

// JWT userId decode
const token = `h.${Buffer.from(JSON.stringify({ userId: "u9" })).toString("base64url")}.s`;
assert.equal(decodeUserId(token), "u9");
assert.equal(decodeUserId("garbage"), null);

console.log("outbox-core: ok");
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd planting-geotracker-app && npx tsx src/lib/plants/outbox-core.check.ts`
Expected: FAIL with a "Cannot find module" error for `./outbox-core` or `../jwt`.

- [ ] **Step 3: Implement `jwt.ts`**

`src/lib/jwt.ts`:

```ts
/**
 * Lê `userId` do payload de um JWT sem verificar assinatura. Uso só local
 * (identificar o dono das ops offline); quem valida o token é o backend.
 */
export function decodeUserId(token: string): string | null {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = part + "=".repeat((4 - (part.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return typeof payload.userId === "string" ? payload.userId : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Implement `outbox-core.ts`**

`src/lib/plants/outbox-core.ts`:

```ts
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
  return images.filter((uri) => !used.has(uri));
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
  const dropped = ops.filter(idle);
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
```

- [ ] **Step 5: Run the check to verify it passes**

Run: `npx tsx src/lib/plants/outbox-core.check.ts`
Expected: `outbox-core: ok`

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "outbox-core|jwt.ts"`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/lib/plants/outbox-core.ts src/lib/plants/outbox-core.check.ts src/lib/jwt.ts
git commit -m "feat(offline): pure outbox core with compaction and self-check"
```

---

### Task 4: App — outbox persistence, sync-op, network and session helpers

**Files:**
- Create: `planting-geotracker-app/src/lib/plants/outbox.ts`
- Create: `planting-geotracker-app/src/lib/plants/sync-op.ts`
- Modify: `planting-geotracker-app/src/lib/plants/image-storage.ts:14-16` (isLocalImage moves to core)
- Modify: `planting-geotracker-app/src/lib/plants/image-upload.ts` (MissingImageError)
- Modify: `planting-geotracker-app/src/lib/plants/plant-payload.ts` (type import)
- Modify: `planting-geotracker-app/src/lib/api.ts` (timeout, keep axios error)
- Modify: `planting-geotracker-app/src/lib/session.ts` (getSessionUserId)

**Interfaces:**
- Consumes: everything from Task 3.
- Produces:
  - `outbox.ts`: `readOutbox(): Promise<OutboxOp[]>`, `initOutbox(userId: string | null): Promise<void>`, `enqueue(op: OutboxOp): Promise<void>`, `takeNext(userId: string): Promise<OutboxOp | undefined>`, `complete(opId: string, result?: Completion): Promise<OutboxOp[]>`, `release(opId: string)`, `fail(opId: string, message: string)`, `retry(opId: string)`, `discard(opId: string): Promise<void>`
  - `sync-op.ts`: `type SendResult = "done" | "failed" | "offline" | "unauthorized"`, `sendOp(op: OutboxOp): Promise<SendResult>`
  - `session.ts`: `getSessionUserId(): Promise<string | null>`
  - `image-upload.ts`: `class MissingImageError`

- [ ] **Step 1: Move `isLocalImage` to the core**

In `image-storage.ts` replace:

```ts
/** URI local de arquivo (file://). URLs remotas (http/https) já foram enviadas. */
export function isLocalImage(uri?: string | null): uri is string {
  return !!uri && uri.startsWith("file://");
}
```

with:

```ts
import { isLocalImage } from "./outbox-core";

export { isLocalImage };
```

Put the `import` at the top with the other imports and keep the `export { isLocalImage };` line in place.

- [ ] **Step 2: MissingImageError in `image-upload.ts`**

Add after the `fileMeta` function:

```ts
/** Foto sumiu do aparelho: erro permanente (não adianta tentar de novo). */
export class MissingImageError extends Error {
  constructor() {
    super("Foto não encontrada no aparelho.");
    this.name = "MissingImageError";
  }
}
```

and replace `throw new Error("Arquivo de imagem não encontrado para upload");` with `throw new MissingImageError();`.

- [ ] **Step 3: `plant-payload.ts` accepts the form type**

Replace `import { PlantData } from "./offline";` with `import type { PlantFormData } from "@/src/pages/add-plants/add-plants-schema";`. Replace the signature with `export function toApiCreateBody(data: PlantFormData) {`, and replace its first line with:

```ts
  const { id: _id, sync: _sync, ...rest } = data as PlantFormData & { sync?: boolean };
```

- [ ] **Step 4: `api.ts` timeout and error with status**

Add `const TIMEOUT = 15000;` below `API_URL`, and set it on the instance:

```ts
export const AXIOS_INSTANCE = Axios.create({
  baseURL: process.env.EXPO_PUBLIC_BACKEND || API_URL,
  // Sinal fraco: sem timeout o request pendura e a op nunca volta para a fila.
  timeout: TIMEOUT,
});
```

In `refreshAccessToken` pass the timeout: `}>(\`${API_URL}/authentication/refresh\`, { refreshToken }, { timeout: TIMEOUT });`

At the end of the response interceptor replace:

```ts
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    return Promise.reject(error);
```

with:

```ts
    // Mantém o AxiosError (com response.status) para o sync classificar;
    // só troca a mensagem pela do servidor.
    if (error.response?.data?.message) {
      error.message = error.response.data.message;
    }
    return Promise.reject(error);
```

- [ ] **Step 5: `session.ts` getSessionUserId**

Add `import { decodeUserId } from "./jwt";` and:

```ts
/** Dono das ops offline: userId do accessToken salvo (decode local). */
export async function getSessionUserId(): Promise<string | null> {
  const token = await getAccessToken();
  return token ? decodeUserId(token) : null;
}
```

- [ ] **Step 6: Create `outbox.ts`**

```ts
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
```

- [ ] **Step 7: Create `sync-op.ts`**

```ts
import Axios from "axios";
import { FindAllPlants201Item } from "../../http/generated/api.schemas";
import { updatePlant } from "../../http/generated/plant/plant";
import {
  createPlants,
  deletePlants,
  getFindAllPlantsQueryKey,
} from "../../http/generated/plants/plants";
import { queryClient } from "../react-query";
import { deletePlantImage } from "./image-storage";
import { MissingImageError, uploadPlantImage } from "./image-upload";
import { complete, fail, release } from "./outbox";
import { isLocalImage, OutboxOp } from "./outbox-core";
import { toApiCreateBody } from "./plant-payload";

export type SendResult = "done" | "failed" | "offline" | "unauthorized";

const setPlants = (fn: (old: FindAllPlants201Item[]) => FindAllPlants201Item[]) =>
  queryClient.setQueryData<FindAllPlants201Item[]>(
    getFindAllPlantsQueryKey(),
    (old = []) => fn(old)
  );

const upsertPlant = (plant: FindAllPlants201Item) =>
  setPlants((old) => [...old.filter((p) => p.id !== plant.id), plant]);

/**
 * Envia uma op. Atualiza o cache ANTES de remover a op, para a planta não
 * sumir da lista entre os dois passos.
 */
export async function sendOp(op: OutboxOp): Promise<SendResult> {
  try {
    if (op.kind === "delete") {
      await deletePlants({ id: op.plantId }).catch(ignoreNotFound);
      setPlants((old) => old.filter((p) => p.id !== op.plantId));
      await complete(op.opId);
      return "done";
    }

    const body = toApiCreateBody(op.payload!);
    const localImage = isLocalImage(body.image) ? body.image : null;
    if (localImage) body.image = await uploadPlantImage(localImage);
    const image =
      localImage && body.image ? { local: localImage, remote: body.image } : undefined;

    if (op.kind === "create") {
      const created = await createPlants({ ...body, offlinePreviousId: op.plantId });
      upsertPlant(created as unknown as FindAllPlants201Item);
      await complete(op.opId, { serverId: created.id, image });
    } else {
      const updated = await updatePlant({ id: op.plantId, ...body });
      upsertPlant(updated as unknown as FindAllPlants201Item);
      await complete(op.opId, { image });
    }

    if (localImage) await deletePlantImage(localImage);
    return "done";
  } catch (error) {
    return handleError(op, error);
  }
}

/** Delete de planta que já não existe conta como sucesso. */
function ignoreNotFound(error: unknown) {
  if (Axios.isAxiosError(error) && error.response?.status === 404) return;
  throw error;
}

async function handleError(op: OutboxOp, error: unknown): Promise<SendResult> {
  if (Axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (!status) {
      await release(op.opId); // sem rede / timeout
      return "offline";
    }
    if (status === 401) {
      await release(op.opId); // sessão caiu; a op espera o próximo login
      return "unauthorized";
    }
    await fail(
      op.opId,
      status === 404
        ? "A planta não existe mais no servidor."
        : error.message || `Erro ${status}`
    );
    return "failed";
  }

  if (error instanceof MissingImageError) {
    await fail(op.opId, error.message);
    return "failed";
  }

  // Upload nativo (FileSystem) sem rede ou 5xx do R2: tenta de novo depois.
  await release(op.opId);
  return "offline";
}
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "outbox|sync-op|image-|plant-payload|api.ts|session.ts|jwt"`
Expected: no output. Note that `offline-context.tsx`, `add-plants-screen.tsx` and the list screens still import `./offline` and compile for now. Task 5 and Task 6 remove those imports.

- [ ] **Step 9: Re-run the core check**

Run: `npx tsx src/lib/plants/outbox-core.check.ts`
Expected: `outbox-core: ok`

- [ ] **Step 10: Commit**

```bash
git add src/lib/plants/outbox.ts src/lib/plants/sync-op.ts src/lib/plants/image-storage.ts src/lib/plants/image-upload.ts src/lib/plants/plant-payload.ts src/lib/api.ts src/lib/session.ts
git commit -m "feat(offline): outbox storage, sync-op, axios timeout"
```

---

### Task 5: App — OfflineContext sync engine, usePlantsView, cache 30d, logout clears cache

**Files:**
- Modify (full rewrite): `planting-geotracker-app/src/context/offline-context.tsx`
- Modify: `planting-geotracker-app/src/lib/react-query.ts`
- Modify: `planting-geotracker-app/src/context/auth-context.tsx:78-86`

**Interfaces:**
- Consumes: `outbox.ts`, `sync-op.ts`, `outbox-core.ts`, `getSessionUserId`, `subscribeSession`.
- Produces:
  - `useOfflineContext(): { ops: OutboxOp[]; pendingCount: number; failedCount: number; isConnected: boolean; isSyncing: boolean; syncNow(): Promise<void>; savePlant(data: PlantFormData, plantId?: string): Promise<void>; deletePlant(plantId: string): Promise<void>; retryOp(opId: string): Promise<void>; discardOp(opId: string): Promise<void> }`
  - `usePlantsView(): { plants: ViewPlant[]; isServerLoaded: boolean }`

- [ ] **Step 1: Rewrite `offline-context.tsx`**

```tsx
import NetInfo from "@react-native-community/netinfo";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  const syncingRef = useRef(false);
  const rerunRef = useRef(false);

  const refresh = useCallback(async () => {
    const userId = await getSessionUserId();
    const all = await outbox.readOutbox();
    setOps(userId ? all.filter((o) => o.userId === userId) : []);
  }, []);

  /** Envia a fila em ordem. Para ao perder a rede ou a sessão. */
  const syncNow = useCallback(async (): Promise<void> => {
    if (syncingRef.current) {
      rerunRef.current = true; // op enfileirada durante o sync
      return;
    }
    const userId = await getSessionUserId();
    if (!userId) return;

    syncingRef.current = true;
    setIsSyncing(true);
    let sent = false;
    try {
      for (let op = await outbox.takeNext(userId); op; op = await outbox.takeNext(userId)) {
        const result = await sendOp(op);
        await refresh();
        if (result === "offline" || result === "unauthorized") break;
        sent = true;
      }
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }

    if (sent) {
      queryClient.invalidateQueries({ queryKey: getFindAllPlantsQueryKey() });
    }
    if (rerunRef.current) {
      rerunRef.current = false;
      return syncNow();
    }
  }, [refresh]);

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
      const connected = (state.isConnected && state.isInternetReachable) ?? false;
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
      else if (!syncingRef.current) boot();
    });

    return () => {
      active = false;
      unsubscribeNet();
      appState.remove();
      unsubscribeSession();
    };
  }, [refresh, syncNow]);

  const pendingCount = ops.filter((o) => o.status !== "failed").length;
  const failedCount = ops.length - pendingCount;

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
```

- [ ] **Step 2: Cache 30 days in `react-query.ts`**

Change `gcTime: 1000 * 60 * 60 * 24 * 7, // 7 dias — mantém no cache persistido` to `gcTime: 1000 * 60 * 60 * 24 * 30, // 30 dias — cobre períodos longos sem sinal`, and in `persistOptions` change `maxAge: 1000 * 60 * 60 * 24 * 7, // 7 dias` to `maxAge: 1000 * 60 * 60 * 24 * 30, // 30 dias`.

- [ ] **Step 3: Logout clears the query cache**

In `auth-context.tsx` add `import { queryClient } from "../lib/react-query";` and in `logout` after `await clearSession();` add:

```ts
      // Próximo usuário não vê dados do anterior. O outbox fica (filtrado por
      // userId) e sobe quando este usuário entrar de novo.
      queryClient.clear();
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "offline-context|react-query|auth-context"`
Expected: no output from these files. Errors in screens that still use `offlinePlants`/`loadOfflineCount` are expected and get fixed in Task 6.

- [ ] **Step 5: Commit**

```bash
git add src/context/offline-context.tsx src/lib/react-query.ts src/context/auth-context.tsx
git commit -m "feat(offline): outbox sync engine and plants view"
```

---

### Task 6: App — screens use the outbox

**Files:**
- Modify (full rewrite of logic): `planting-geotracker-app/src/pages/add-plants/add-plants-screen.tsx`
- Modify: `planting-geotracker-app/app/authenticated/(tabs)/plants.tsx`
- Modify: `planting-geotracker-app/app/authenticated/(tabs)/index.tsx`
- Modify: `planting-geotracker-app/src/pages/plants-map/plants-map-screen.tsx`
- Modify: `planting-geotracker-app/src/pages/plants-map/hooks/use-map-plants.ts`
- Delete: `planting-geotracker-app/src/lib/plants/offline.ts`

**Interfaces:**
- Consumes: `useOfflineContext()`, `usePlantsView()`, `ViewPlant` from Task 5 and Task 3.
- Produces: `useMapPlants({ plants: ViewPlant[]; plantTypes?; filters })`, with the same return shape as today.

- [ ] **Step 1: `add-plants-screen.tsx`, imports and state**

Replace the whole import block down to `import { WizardHeader } ...` (keep that last line) with:

```tsx
import CustomModal from "@/src/components/modal";
import { useOfflineContext, usePlantsView } from "@/src/context/offline-context";
import { useFindAllPlantsTypes } from "@/src/http/generated/plants-type/plants-type";
import { useFindMe } from "@/src/http/generated/user/user";
import { colors } from "@/src/lib/colors";
import { convertPlantToFormData } from "@/src/lib/plants/plant-convertion";
import { Ionicons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { PlantFormData, plantFormSchema } from "./add-plants-schema";
import { StepBasicInfo } from "./steps/step-basic-info";
import { StepDetails } from "./steps/step-details";
import { StepLocation } from "./steps/step-location";
import { WizardFooter } from "./steps/wizard-footer";
```

Delete the `NOT_SET` / `OFFLINE` / `ONLINE` constants.

- [ ] **Step 2: `add-plants-screen.tsx`, component body up to `goNext`**

Replace everything from `const [step, setStep] = useState(0);` up to (not including) `const goNext = async () => {` with:

```tsx
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [openWarningModal, setOpenWarningModal] = useState(false);
  const [textModal, setTextModal] = useState({
    title: "",
    message: "",
    icon: "",
    iconColor: colors.green[500],
  });
  const [openDeleteConfirmation, setOpenDeleteConfirmation] = useState(false);

  const { isConnected, pendingCount, savePlant, deletePlant } = useOfflineContext();
  const { plants, isServerLoaded } = usePlantsView();
  const { data: user } = useFindMe();
  const { data: plantType } = useFindAllPlantsTypes();

  // Servidor + fila local: funciona offline para qualquer planta.
  const plant = useMemo(
    () => (plantId ? plants.find((p) => p.id === plantId) : undefined),
    [plants, plantId]
  );
  const isOfflineRecord = !!plant?.offline;

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    reset,
    trigger,
    watch,
    formState: { errors },
  } = useForm<PlantFormData>({
    resolver: zodResolver(plantFormSchema),
  });

  // Remonta o passo de GPS quando os dados de edição chegam,
  // para que a posição salva seja usada como semente do mapa.
  const locationSeedKey = isEditing
    ? `edit-${Boolean(watch("latitude"))}`
    : "new";

  const plantTypeOptions = useMemo(
    () =>
      plantType?.map((p) => ({ label: p.name, value: p.id })) ?? [],
    [plantType]
  );

  // Carrega o formulário uma vez só: o sync em background muda a lista e
  // não pode sobrescrever o que o usuário está editando.
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!plant || loadedRef.current) return;
    loadedRef.current = true;
    reset(convertPlantToFormData({ plantData: plant }));
  }, [plant, reset]);

  useEffect(() => {
    if (!user || !user.center) return;
    setValue("centerId", user.center.id);
  }, [user, setValue]);

  const submit = async (data: PlantFormData) => {
    setIsSubmitting(true);
    try {
      // Sempre grava na fila local; o sync sobe quando houver internet.
      await savePlant(data, plantId);
      router.back();
    } catch (error) {
      console.error("Erro ao salvar planta:", error);
      setTextModal({
        title: "Erro ao salvar planta",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar a planta no aparelho.",
        icon: "alert-circle",
        iconColor: colors.red[500],
      });
      setOpenWarningModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (plantId) await deletePlant(plantId);
    router.back();
  };
```

- [ ] **Step 3: `add-plants-screen.tsx`, render changes**

- Replace the error-screen condition `if (isEditing && isErrorFetchingPlant && isConnected) {` with `if (isEditing && isServerLoaded && !plant && !loadedRef.current) {`, and change its title text `Erro ao carregar planta` to `Planta não encontrada`.
- In the offline banner replace `{offlineCount > 0 ? \` (${offlineCount} pendente(s))\` : ""}` with `{pendingCount > 0 ? \` (${pendingCount} pendente(s))\` : ""}`.
- Replace the loading banner condition `{isEditing && isFetchingPlant && isConnected && (` with `{isEditing && !plant && !loadedRef.current && (`.
- In `<WizardFooter ...>` replace `isSubmitting={isPending}` with `isSubmitting={isSubmitting}`.

Then run: `grep -nE "isPending|isFetchingPlant|isEditingOffline|offlineCount|NetInfo|syncData|saveOfflinePlant" src/pages/add-plants/add-plants-screen.tsx`
Expected: no output.

- [ ] **Step 4: `plants.tsx`**

- Replace the imports of `@/src/http/generated/plants/plants` (the whole `{ getFindAllPlantsQueryKey, useDeletePlants, useFindAllPlants }` block), `removeOfflineStorage` and `queryClient` with nothing, and change the context import to `import { useOfflineContext, usePlantsView } from "@/src/context/offline-context";`.
- Replace `const { data: plants } = useFindAllPlants();` with `const { plants: plantsMerge } = usePlantsView();`.
- Delete `const { mutateAsync: deletePlants } = useDeletePlants();` and the `const [isSyncing, setIsSyncing] = useState(false);` line.
- Replace `const { offlinePlants, loadOfflineCount, syncNow } = useOfflineContext();` and the following `useEffect(() => { loadOfflineCount(); }, [plants]);` with:

```tsx
  const {
    ops,
    pendingCount,
    failedCount,
    isSyncing,
    syncNow,
    deletePlant,
    retryOp,
    discardOp,
  } = useOfflineContext();
```

- Replace the whole `syncAllOfflinePlants` function with:

```tsx
  const syncAllOfflinePlants = () => syncNow();
```

- Replace the whole `deleteSelectedPlants` function with:

```tsx
  const deleteSelectedPlants = async () => {
    if (selectedPlants.size === 0) return;
    setIsDeleting(true);
    // Vai para a fila: funciona offline e sobe no próximo sync.
    for (const plantId of selectedPlants) {
      try {
        await deletePlant(plantId);
      } catch (error) {
        console.error(`Erro ao deletar planta com id ${plantId}:`, error);
      }
    }
    setSelectedPlants(new Set());
    setIsSelectionMode(false);
    setIsDeleting(false);
  };
```

- Delete the `// Merge das plantas online e offline` `plantsMerge` `useMemo` block. `plantsMerge` now comes from `usePlantsView()`.
- In the fuse `dynamicKeys` filter change `if (key === "id" || key === "typeId" || key === "offline") return [];` to `if (["id", "typeId", "offline", "syncError", "center", "type"].includes(key)) return [];`.
- In the Sync Section replace every `offlinePlants.length` / `offlinePlants?.length` with `pendingCount`, and the text `Tudo sincronizado! Nenhuma planta offline encontrada.` stays.
- Right after the Sync Section closing `)}` and before `{/* Plants List */}`, add the failures banner:

```tsx
      {!isSelectionMode && failedCount > 0 && (
        <View className="mx-6 mt-4 bg-red-50 p-3 rounded-xl border border-red-200">
          <Text className="text-red-700 font-semibold mb-2">
            {failedCount} alteraç{failedCount !== 1 ? "ões" : "ão"} com erro de
            sincronização
          </Text>
          {ops
            .filter((o) => o.status === "failed")
            .map((o) => (
              <View key={o.opId} className="mb-2">
                <Text className="text-red-700 text-sm">
                  {o.payload?.name ?? "Exclusão"}: {o.lastError}
                </Text>
                <View className="flex-row gap-4 mt-1">
                  <TouchableOpacity onPress={() => retryOp(o.opId)}>
                    <Text className="text-green-700 font-semibold">
                      Tentar de novo
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => discardOp(o.opId)}>
                    <Text className="text-red-600 font-semibold">Descartar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
        </View>
      )}
```

- In the Confirm Sync modal, `onPress: async () => { await syncAllOfflinePlants(); setConfirmSync(false); }` stays as is.

Then run: `grep -nE "offlinePlants|loadOfflineCount|removeOfflineStorage|useDeletePlants|setIsSyncing|queryClient" "app/authenticated/(tabs)/plants.tsx"`
Expected: no output.

- [ ] **Step 5: `index.tsx`, list, counts and logout warning**

- Replace imports: remove `import { useFindAllPlants } from "@/src/http/generated/plants/plants";`, change the context import to `import { useOfflineContext, usePlantsView } from "@/src/context/offline-context";`, change `import React, { useEffect, useMemo } from "react";` to `import React, { useState } from "react";`, and add `import CustomModal from "@/src/components/modal";`.
- Replace:

```tsx
  const { data: plants } = useFindAllPlants();
```

with `const { plants: plantsMerge } = usePlantsView();`.
- Replace `const { offlinePlants, loadOfflineCount } = useOfflineContext();` and the following `useEffect(() => { loadOfflineCount(); }, [plants]);` with:

```tsx
  const { pendingCount, failedCount } = useOfflineContext();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const unsynced = pendingCount + failedCount;
```

- Delete the `// Merge das plantas online e offline` `plantsMerge` `useMemo` block.
- Change `<TouchableOpacity onPress={logout}>` to `<TouchableOpacity onPress={() => (unsynced > 0 ? setConfirmLogout(true) : logout())}>`.
- Change `{plants?.length || 0}` to `{plantsMerge.length}` and `{offlinePlants?.length || 0}` to `{unsynced}`. Change its label `Plantas salvas offline` to `Pendentes de sincronizar`.
- Change `{plantsMerge\n              .sort(` to `{[...plantsMerge]\n              .sort(`, so the memoized array is not mutated.
- Just before the closing `</View>` of the root `<View className="flex-1 bg-gray-50">`, add:

```tsx
      {confirmLogout && (
        <CustomModal
          visible={confirmLogout}
          icon="cloud-offline"
          iconColor="#EA580C"
          title="Dados não sincronizados"
          message={`${unsynced} alteraç${unsynced !== 1 ? "ões" : "ão"} ainda não ${unsynced !== 1 ? "foram enviadas" : "foi enviada"}. Elas continuam salvas neste aparelho e sobem quando você entrar de novo com esta conta.`}
          actions={[
            { text: "Cancelar", onPress: () => setConfirmLogout(false), style: "secondary" },
            {
              text: "Sair mesmo assim",
              style: "danger",
              onPress: () => {
                setConfirmLogout(false);
                logout();
              },
            },
          ]}
        />
      )}
```

Then run: `grep -nE "offlinePlants|loadOfflineCount|useFindAllPlants\b|useMemo|useEffect" "app/authenticated/(tabs)/index.tsx"`
Expected: no output.

- [ ] **Step 6: Map hook takes the single view list**

In `use-map-plants.ts`:
- Replace the imports of `FindAllPlants201Item` and `PlantData` with `import { ViewPlant } from "@/src/lib/plants/outbox-core";`, keeping `FindAllPlantsTypes201Item` imported from `@/src/http/generated/api.schemas`.
- Replace the params interface with:

```ts
interface UseMapPlantsParams {
  plants?: ViewPlant[];
  plantTypes?: FindAllPlantsTypes201Item[];
  filters: MapFilters;
}
```

- Change the function params to `{ plants: viewPlants, plantTypes, filters }`.
- Replace the whole `allPlants` `useMemo` with:

```ts
  const allPlants = useMemo<MapPlant[]>(
    () =>
      (viewPlants ?? [])
        .map((p) => {
          const latitude = toNumber(p.latitude);
          const longitude = toNumber(p.longitude);
          const typeId = p.typeId ?? null;
          return {
            id: p.id,
            name: p.name,
            latitude,
            longitude,
            typeId,
            typeName:
              p.type?.name ?? (typeId ? typeNameById.get(typeId) : "") ?? "Sem tipo",
            color: colorForType(typeId),
            offline: p.offline,
            raw: p,
          };
        })
        .filter((p) => isValidCoord(p.latitude, p.longitude)),
    [viewPlants, typeNameById]
  );
```

In `plants-map-screen.tsx`:
- Replace `import { useOfflineContext } from "@/src/context/offline-context";` with `import { useOfflineContext, usePlantsView } from "@/src/context/offline-context";` and remove the `useFindAllPlants` import.
- Replace `const { data: plants } = useFindAllPlants();` with `const { plants } = usePlantsView();`.
- Remove `offlinePlants,` and `loadOfflineCount,` from the `useOfflineContext()` destructure, and delete the `useEffect(() => { loadOfflineCount(); }, [plants]);`.
- In the `useMapPlants({...})` call replace `onlinePlants: plants,\n      offlinePlants,` with `plants,`.

- [ ] **Step 7: Delete the legacy module**

Run: `git rm src/lib/plants/offline.ts && grep -rn "plants/offline\"" src app`
Expected: no output from grep.

- [ ] **Step 8: Typecheck and lint**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `6` (baseline). Then run `npx tsc --noEmit 2>&1 | grep -vE "skeleton.tsx|ui/text.tsx|plant-convertion.ts"`. Expected: no output. Then run `npx expo lint`. Expected: no new errors in the touched files.

- [ ] **Step 9: Re-run the core check**

Run: `npx tsx src/lib/plants/outbox-core.check.ts`
Expected: `outbox-core: ok`

- [ ] **Step 10: Commit**

```bash
git add -A src app
git commit -m "feat(offline): screens write through outbox"
```

---

### Task 7: Manual device verification

**Files:** none. Record the results in the final report.

Build: `yarn android` (or `yarn apk`) against the backend with Tasks 1 and 2 deployed. Only deploy the backend if the user authorizes it. Otherwise point `EXPO_PUBLIC_BACKEND` and orval to a local backend. Note: generated URLs are absolute, so run `yarn orval` for local.

- [ ] **Step 1: Airplane mode, new plant.** Create, edit and delete a new plant offline. Each step shows in the list with the OFFLINE badge. Deleted plants disappear. Reconnect: only the surviving state reaches the server, with no duplicate.
- [ ] **Step 2: Airplane mode, synced plant.** Edit a synced plant, reconnect, and confirm the server has the edit. Delete another, reconnect, and confirm it is gone on the server.
- [ ] **Step 3: Kill the app with pending ops.** Reopen offline: the list still shows the pending plants. Reconnect: they sync.
- [ ] **Step 4: Weak signal.** Use Android emulator network throttling or a hotspot with poor signal. Submit: the screen closes right away, and the op syncs later or stays pending. There is no hang and no duplicate after reconnect.
- [ ] **Step 5: Photo offline.** Create with a photo offline, reconnect: the image URL on the server is the R2 URL, and the local file is deleted.
- [ ] **Step 6: Logout with pending ops.** The warning appears. Log in with another account: that user does not see the previous user's pending plants. Log back in with the first account: the ops sync.
- [ ] **Step 7: Session after 1h+.** Leave the app idle for more than 1h online, then use it. It must not log out (this is the refresh route fix).
- [ ] **Step 8: Legacy data.** Before installing the new build, save one plant offline with the old build. After updating, it appears and syncs.
