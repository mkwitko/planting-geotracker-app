import { FindAllPlants201Item } from "../../http/generated/api.schemas";
import { updatePlant } from "../../http/generated/plant/plant";
import {
  createPlants,
  deletePlants,
  getFindAllPlantsQueryKey,
} from "../../http/generated/plants/plants";
import { queryClient } from "../react-query";
import { deletePlantImage } from "./image-storage";
import { uploadPlantImage } from "./image-upload";
import { complete, discard, fail, release } from "./outbox";
import { isLocalImage, OutboxOp } from "./outbox-core";
import { toApiCreateBody } from "./plant-payload";
import { classifyError, uploadOrKeep } from "./sync-rules";

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
      await deletePlants({ id: op.plantId });
      setPlants((old) => old.filter((p) => p.id !== op.plantId));
      await complete(op.opId);
      return "done";
    }

    const body = toApiCreateBody(op.payload!);
    const localImage = isLocalImage(body.image) ? body.image : null;
    if (localImage) {
      body.image = await uploadOrKeep(op.kind, localImage, uploadPlantImage);
    }
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

async function handleError(op: OutboxOp, error: unknown): Promise<SendResult> {
  switch (classifyError(error)) {
    case "release":
      await release(op.opId);
      return "offline";
    case "unauthorized":
      await release(op.opId); // sessão caiu; a op espera o próximo login
      return "unauthorized";
    case "notFound":
      if (op.kind === "update") {
        await fail(op.opId, "A planta não existe mais no servidor.");
        return "failed";
      }
      // Delete: já não existe. Create: excluída no servidor, não ressuscita.
      // discard leva as ops dependentes e a foto local.
      setPlants((old) => old.filter((p) => p.id !== op.plantId));
      await discard(op.opId);
      return "done";
    case "fail":
      await fail(op.opId, error instanceof Error && error.message ? error.message : "Erro ao sincronizar");
      return "failed";
  }
}
