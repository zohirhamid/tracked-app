import { expect, test } from "@playwright/test";

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `tracked-e2e-${runId}@example.com`;
const password = `Tracked-e2e-${runId}!`;
const username = `tracked_e2e_${runId.replaceAll("-", "_")}`.slice(0, 150);
const trackerName = `Mood ${runId}`;

test("complete email account and tracking journey", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "CREATE ACCOUNT" }).click();

  await expect(page.getByRole("heading", { name: "Choose a username" })).toBeVisible();
  await page.getByLabel("Username").fill(username);
  await page.getByRole("button", { name: "CONTINUE" }).click();

  await expect(page.getByRole("button", { name: "TRACKERS" })).toBeVisible();
  await page.getByRole("button", { name: "TRACKERS" }).click();
  await page.getByRole("button", { name: /NEW TRACKER/ }).click();
  await page.getByLabel("Name").fill(trackerName);
  await page.getByRole("radio", { name: "Rating" }).check();
  await page.getByLabel("Minimum").fill("1");
  await page.getByLabel("Maximum").fill("5");
  await page.getByRole("button", { name: "ADD TRACKER" }).click();
  await expect(page.getByRole("heading", { name: trackerName })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "+ LOG ENTRY" }).click();
  await page.getByLabel("Value").fill("4");
  await page.getByRole("button", { name: "SAVE ENTRY" }).click();

  const loggedCell = page.getByRole("cell", { name: new RegExp(`^${trackerName}, .*: 4/5$`) });
  await expect(loggedCell).toBeVisible();
  await loggedCell.click();
  const inlineEditor = loggedCell.locator("input.inline-editor");
  await inlineEditor.fill("5");
  await inlineEditor.press("Enter");
  await expect(page.getByRole("cell", { name: new RegExp(`^${trackerName}, .*: 5/5$`) })).toBeVisible();

  const currentMonth = (await page.getByRole("heading", { level: 1 }).textContent()).trim();
  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(currentMonth);
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(currentMonth);

  await page.getByRole("button", { name: "SIGN OUT" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "SIGN IN" }).click();
  await expect(page.getByRole("button", { name: "SIGN OUT" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: trackerName })).toBeVisible();
});

test("Google sign-in reaches the configured provider", async ({ page }) => {
  await page.goto("/");
  const googleButton = page.getByRole("button", { name: "SIGN IN WITH GOOGLE" });
  await expect(googleButton).toBeEnabled();
  await googleButton.click();
  await page.waitForURL((url) => url.hostname === "accounts.google.com");

  const providerUrl = new URL(page.url());
  expect(providerUrl.searchParams.get("client_id")).toBeTruthy();
  expect(providerUrl.searchParams.get("redirect_uri")).toContain(
    "/accounts/google/login/callback/",
  );
});
