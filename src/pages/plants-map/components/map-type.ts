export type MapTypeName = "standard" | "satellite" | "hybrid";

const CYCLE: MapTypeName[] = ["standard", "satellite", "hybrid"];

export const nextMapType = (current: MapTypeName): MapTypeName =>
  CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
