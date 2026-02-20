import { defineConfig, devices } from "@playwright/test";

const PORT = 3210;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  outputDir: "output/playwright/test-results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "output/playwright/report", open: "never" }],
  ],
  use: {
    baseURL: BASE_URL,
    locale: "en-US",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: process.env.CI
      ? `npm run start -- -p ${PORT}`
      : `npm run dev -- --port ${PORT}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NODE_ENV: "test",
      NEXTAUTH_URL: BASE_URL,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "playwright-secret",
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://postgres:postgres@127.0.0.1:5432/soot?schema=public",
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "sk-playwright-placeholder",
      OPENAI_MODEL: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      OPENAI_AGENT_MODEL: process.env.OPENAI_AGENT_MODEL ?? "gpt-4.1-mini",
      OPENAI_CONVERSATION_TITLE_MODEL:
        process.env.OPENAI_CONVERSATION_TITLE_MODEL ?? "gpt-4o-mini",
      OPENAI_SHOPPING_MODEL: process.env.OPENAI_SHOPPING_MODEL ?? "gpt-4o-mini",
      OPENAI_BUDGET_MODEL: process.env.OPENAI_BUDGET_MODEL ?? "gpt-4.1-mini",
    },
  },
});
