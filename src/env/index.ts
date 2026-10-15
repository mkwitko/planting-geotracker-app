import { z } from "zod";

const envSchema = z.object({
  MODE: z.enum(["development", "production", "test"]),
  VITE_HTTP_API_URL: z.string().url(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    "❌ Invalid environment variables: ",
    parsedEnv.error.flatten().fieldErrors
  );
  throw new Error("❌ Invalid environment variables.");
}

export const env = parsedEnv.data;
