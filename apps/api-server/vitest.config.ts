import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./src/test/database-url";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    globalSetup: ["./src/test/global-setup.ts"],
    setupFiles: ["./src/test/setup.ts"],
    env: {
      DATABASE_URL: testDatabaseUrl(),
      LOG_LEVEL: "silent",
      NODE_ENV: "test",
    },
    // All test files share one database, so run them one at a time.
    fileParallelism: false,
  },
});
