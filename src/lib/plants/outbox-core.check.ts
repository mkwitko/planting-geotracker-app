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

// delete after a create that already reached the network keeps the create
// (the server may have it) and appends the delete
const sentOnce: OutboxOp = { ...makeOp("create", "local_s", U, form()), attempts: 1 };
const keep = compact([sentOnce], makeOp("delete", "local_s", U));
assert.deepEqual(keep.ops.map((o) => o.kind), ["create", "delete"]);
// ...but a create the server rejected (failed) is just dropped
const rejected: OutboxOp = { ...sentOnce, status: "failed", lastError: "400" };
assert.equal(compact([rejected], makeOp("delete", "local_s", U)).ops.length, 0);

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
