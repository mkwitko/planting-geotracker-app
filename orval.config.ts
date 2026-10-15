import { config } from "dotenv";
import { defineConfig } from "orval";

config();

export default defineConfig({
  api: {
    input: `${process.env.VITE_HTTP_API_URL}/docs/json`, // Your OpenAPI spec URL
    output: {
      baseUrl: process.env.VITE_HTTP_API_URL, // Your API base URL
      clean: true,
      target: "./src/http/generated/api.ts", // Target for generated API code
      client: "react-query",
      httpClient: "axios", // Use Axios as the HTTP client
      mode: "tags-split", // Use tag splitting mode
      override: {
        mutator: {
          path: "src/lib/api.ts", // Path to your Axios instance
          name: "customInstance", // Ensure this matches the exported name
        },
      },
    },
  },
});
