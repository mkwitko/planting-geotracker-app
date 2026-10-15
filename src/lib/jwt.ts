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
