import * as FileSystem from "expo-file-system";
import { getPressignedUrl } from "../../http/generated/upload/upload";
import { isLocalImage } from "./image-storage";
import { MissingImageError } from "./sync-rules";

const FOLDER = "plant-image";

// Public read base of the image bucket; set EXPO_PUBLIC_R2_PUBLIC_URL.
// Placeholder fallback if the env var is not defined.
const PUBLIC_BASE =
  process.env.EXPO_PUBLIC_R2_PUBLIC_URL ||
  "https://assets.example.com";

function fileMeta(uri: string): { fileName: string; fileType: string } {
  const clean = uri.split("?")[0];
  const ext = (clean.match(/\.(jpe?g|png)$/i)?.[1] ?? "jpg").toLowerCase();
  const base = clean.split("/").pop() || `plant_${Date.now()}.${ext}`;
  // fileName já é único (gerado em persistPlantImage como plant_<ts>.<ext>).
  const fileName = base.match(/\.(jpe?g|png)$/i) ? base : `${base}.${ext}`;
  const fileType = ext === "png" ? "image/png" : "image/jpeg";
  return { fileName, fileType };
}


/**
 * Sobe uma foto local para o Cloudflare R2 via URL pré-assinada (S3-compat) e
 * devolve a URL pública final — valor gravado em `image` na planta.
 *
 * Backend usa Key = fileName (sem prefixo de pasta) e NÃO transforma `image`
 * na leitura, então o app grava a URL pública completa (PUBLIC_BASE/fileName).
 *
 * Se `uri` já for remota (não file://), devolve como está — sync idempotente.
 */
export async function uploadPlantImage(uri: string): Promise<string> {
  if (!isLocalImage(uri)) return uri;

  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    throw new MissingImageError();
  }

  const { fileName, fileType } = fileMeta(uri);

  const { pressignedUrl } = await getPressignedUrl({
    folder: FOLDER,
    fileSize: info.size ?? 0,
    fileName,
    fileType,
  });

  // PUT binário direto no R2 (presigned S3-compatible).
  const result = await FileSystem.uploadAsync(pressignedUrl, uri, {
    httpMethod: "PUT",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { "Content-Type": fileType },
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Falha no upload da foto (status ${result.status})`);
  }

  // Key no R2 = fileName puro (backend não prefixa pasta). URL pública final.
  return `${PUBLIC_BASE}/${fileName}`;
}
