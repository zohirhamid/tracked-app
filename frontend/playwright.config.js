import os from "node:os";
import path from "node:path";

import { defineConfig } from "@playwright/test";

const deploymentUrl = process.env.E2E_BASE_URL;
const localDatabasePath = path.join(os.tmpdir(), `tracked-e2e-${process.pid}.sqlite3`);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: deploymentUrl || "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: deploymentUrl ? undefined : [
    {
      command: "../backend/.venv/bin/python ../backend/manage.py migrate && ../backend/.venv/bin/python ../backend/manage.py runserver 127.0.0.1:8000",
      env: {
        SECRET_KEY: "tracked-e2e-development-secret",
        DJANGO_DEBUG: "True",
        COOKIE_SECURE: "False",
        DATABASE_URL: `sqlite:///${localDatabasePath}`,
        GOOGLE_CLIENT_ID: "tracked-e2e.apps.googleusercontent.com",
        GOOGLE_CLIENT_SECRET: "tracked-e2e-client-secret",
      },
      url: "http://127.0.0.1:8000/health/",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "npm run dev -- --host 127.0.0.1",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
