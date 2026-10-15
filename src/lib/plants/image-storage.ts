import * as FileSystem from "expo-file-system";
import { isLocalImage } from "./outbox-core";

/**
 * Diretório permanente das fotos de planta. `cacheDirectory` (onde o
 * ImagePicker deixa o arquivo) pode ser limpo pelo SO — então copiamos a foto
 * para `documentDirectory`, que sobrevive a reinício do app e à limpeza de
 * cache, garantindo que a foto exista até o upload no próximo sync online.
 */
export const PLANT_IMAGE_DIR = `${FileSystem.documentDirectory}plant-images/`;

export { isLocalImage };

function getExtension(uri: string): string {
  const clean = uri.split("?")[0];
  const match = clean.match(/\.(jpe?g|png)$/i);
  return match ? match[0].toLowerCase() : ".jpg";
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PLANT_IMAGE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PLANT_IMAGE_DIR, {
      intermediates: true,
    });
  }
}

/**
 * Copia a foto recém-escolhida para o diretório permanente e devolve a nova
 * URI. Se já estiver no diretório permanente ou for remota, devolve como está.
 */
export async function persistPlantImage(uri: string): Promise<string> {
  if (!isLocalImage(uri)) return uri; // remota: nada a fazer
  if (uri.startsWith(PLANT_IMAGE_DIR)) return uri; // já persistida

  try {
    await ensureDir();
    const ext = getExtension(uri);
    // timestamp + sufixo aleatório: evita colisão/overwrite no R2 entre
    // devices ou fotos tiradas no mesmo milissegundo.
    const rand = Math.random().toString(36).slice(2, 8);
    const fileName = `plant_${Date.now()}_${rand}${ext}`;
    const dest = `${PLANT_IMAGE_DIR}${fileName}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch (error) {
    console.error("Erro ao persistir foto:", error);
    return uri; // fallback: mantém a URI de cache
  }
}

/** Remove a cópia local após upload bem-sucedido. Ignora se não existir. */
export async function deletePlantImage(uri?: string | null): Promise<void> {
  if (!isLocalImage(uri)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (error) {
    console.error("Erro ao remover foto local:", error);
  }
}
