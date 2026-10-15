// Self-check das regras do sync. Rodar: npx tsx src/lib/plants/sync-rules.check.ts
import assert from "node:assert/strict";
import { AxiosError } from "axios";
import {
  classifyError,
  MissingImageError,
  singleFlight,
  uploadOrKeep,
} from "./sync-rules";

const http = (status?: number) =>
  new AxiosError("x", "ERR", undefined, undefined, status ? ({ status } as any) : undefined);

(async () => {
  // classificação de erros
  assert.equal(classifyError(http()), "release"); // sem resposta: sem rede
  assert.equal(classifyError(http(502)), "release"); // proxy fora com sinal fraco
  assert.equal(classifyError(http(401)), "unauthorized");
  assert.equal(classifyError(http(404)), "notFound");
  assert.equal(classifyError(http(400)), "fail");
  assert.equal(classifyError(new MissingImageError()), "fail");
  assert.equal(classifyError(new Error("upload nativo sem rede")), "release");

  // foto local sumida: update mantém a do servidor, create falha
  const missing = async () => {
    throw new MissingImageError();
  };
  assert.equal(await uploadOrKeep("update", "file:///a.jpg", missing), undefined);
  await assert.rejects(uploadOrKeep("create", "file:///a.jpg", missing), MissingImageError);
  assert.equal(await uploadOrKeep("create", "file:///a.jpg", async () => "https://r2/a.jpg"), "https://r2/a.jpg");

  // singleFlight: nunca dois loops ao mesmo tempo; chamadas durante a execução
  // viram UMA rodada extra no fim
  let active = 0;
  let maxActive = 0;
  let runs = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const runner = singleFlight(async () => {
    runs++;
    active++;
    maxActive = Math.max(maxActive, active);
    if (runs === 1) await gate;
    active--;
  });
  const first = runner.call();
  assert.equal(runner.isRunning(), true);
  const second = runner.call();
  const third = runner.call();
  release();
  await Promise.all([first, second, third]);
  assert.equal(maxActive, 1);
  assert.equal(runs, 2);
  assert.equal(runner.isRunning(), false);

  console.log("sync-rules: ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
