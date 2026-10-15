/** Paleta estável para diferenciar tipos de planta no mapa. */
const PALETTE = [
  "#16A34A", // verde
  "#2563EB", // azul
  "#D97706", // âmbar
  "#DC2626", // vermelho
  "#7C3AED", // roxo
  "#0891B2", // ciano
  "#DB2777", // rosa
  "#65A30D", // lima
  "#EA580C", // laranja
  "#4F46E5", // índigo
];

const NEUTRAL = "#6B7280";

/** Cor determinística por tipo — mesmo tipo sempre mesma cor. */
export function colorForType(typeId?: string | null): string {
  if (!typeId) return NEUTRAL;

  let hash = 0;
  for (let i = 0; i < typeId.length; i++) {
    hash = (hash * 31 + typeId.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
