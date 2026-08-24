import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    // Colocated with the code under test: lib/foo.ts → lib/foo.test.ts.
    include: ["**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    exclude: ["node_modules/**", ".next/**", "migrations/**"],
    // Undo mocks/spies/env stubs between tests so ordering never matters.
    restoreMocks: true,
    unstubEnvs: true,
    alias: {
      "@": path.resolve(__dirname, "./"),
      // Mirrors the tsconfig path alias. Next.js and the Payload CLI resolve
      // this at build time; Vite needs it spelled out or any module that
      // touches Payload fails to resolve at import-analysis time.
      "@payload-config": path.resolve(__dirname, "./payload.config.ts"),
      // Build-time-only marker package; harmless to neutralise under test.
      "server-only": path.resolve(__dirname, "./test/stubs/server-only.ts"),
    },
  },
});
