import z from "zod";

export const plantFormSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  observation: z.string().optional(),
  image: z.string().optional(),
  origin: z.string().optional(),
  identificationNumber: z.string().optional(),
  isIdentified: z.boolean().default(false).optional(),
  plantationDate: z.date().optional(),
  pictureDate: z.date().optional(),
  lastWatering: z.date().optional(),
  lastFertilization: z.date().optional(),
  lastPestControl: z.date().optional(),
  lastPruning: z.date().optional(),
  lastHarvest: z.date().optional(),
  lastWeeding: z.date().optional(),
  lastSoilAnalysis: z.date().optional(),
  latitude: z
    .string()
    .min(1, "Capture as coordenadas GPS")
    .refine((v) => !Number.isNaN(parseFloat(v)), "Coordenada inválida"),
  longitude: z
    .string()
    .min(1, "Capture as coordenadas GPS")
    .refine((v) => !Number.isNaN(parseFloat(v)), "Coordenada inválida"),
  address: z.string().optional(),
  centerId: z.string(),
  typeId: z.string(),
});

export type PlantFormData = z.infer<typeof plantFormSchema>;
