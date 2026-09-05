import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    include: ["tests/**/*.test.ts", "packages/*/src/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**"],
    },
  },
});