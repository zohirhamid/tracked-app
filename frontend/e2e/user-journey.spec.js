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
  const currentMonthIndex = new Date().getMonth();
  const alternativeMonthIndex = (currentMonthIndex + 11) % 12;
  const alternativeMonth = new Intl.DateTimeFormat("en-GB", { month: "short" }).format(new Date(2026, alternativeMonthIndex, 1)).toUpperCase();
  const currentMonthTab = new Intl.DateTimeFormat("en-GB", { month: "short" }).format(new Date(2026, currentMonthIndex, 1)).toUpperCase();
  await page.getByRole("tab", { name: alternativeMonth }).click();
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(currentMonth);
  await page.getByRole("tab", { name: currentMonthTab }).click();
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

test.describe("mobile daily logger", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("switches automatically and supports log, week, and month views", async ({ page }) => {
    const runtimeErrors = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) runtimeErrors.push(message.text());
    });
    const mobileRunId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const mobileEmail = `tracked-mobile-${mobileRunId}@example.com`;
    const mobilePassword = `Tracked-mobile-${mobileRunId}!`;
    const mobileUsername = `tracked_mobile_${mobileRunId.replaceAll("-", "_")}`.slice(0, 150);
    const mobileTracker = `Mood ${mobileRunId}`;
    const mobileTimeTracker = `Wake ${mobileRunId}`;

    await page.goto("/");
    await page.getByRole("button", { name: "Create an account" }).click();
    await page.getByLabel("Email").fill(mobileEmail);
    await page.getByLabel("Password", { exact: true }).fill(mobilePassword);
    await page.getByLabel("Confirm password").fill(mobilePassword);
    await page.getByRole("button", { name: "CREATE ACCOUNT" }).click();
    await page.getByLabel("Username").fill(mobileUsername);
    await page.getByRole("button", { name: "CONTINUE" }).click();

    await expect(page.getByRole("navigation", { name: "Mobile tracker view" })).toBeVisible();
    await expect(page.getByRole("button", { name: "LOG" })).toHaveClass(/active/);
    await expect(page.getByRole("button", { name: "\+ LOG ENTRY" })).toHaveCount(0);

    await page.getByRole("button", { name: "TRACKERS" }).click();
    await page.getByRole("button", { name: /NEW TRACKER/ }).click();
    await page.getByLabel("Name").fill(mobileTracker);
    await page.getByRole("radio", { name: "Rating" }).check();
    await page.getByLabel("Minimum").fill("1");
    await page.getByLabel("Maximum").fill("5");
    await page.getByRole("button", { name: "ADD TRACKER" }).click();
    await expect(page.getByRole("heading", { name: mobileTracker })).toBeVisible();

    await page.getByRole("button", { name: /NEW TRACKER/ }).click();
    await page.getByLabel("Name").fill(mobileTimeTracker);
    await page.getByRole("radio", { name: "Time" }).check();
    await page.getByRole("button", { name: "ADD TRACKER" }).click();
    await expect(page.getByRole("heading", { name: mobileTimeTracker })).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();

    await page.getByRole("radio", { name: "Great" }).click();
    const timeField = page.locator(".mobile-tracker-field").filter({ hasText: mobileTimeTracker });
    const timeInput = timeField.locator('input[type="time"]');
    await timeInput.fill("09:30");
    const fieldBox = await timeField.boundingBox();
    const timeBox = await timeInput.boundingBox();
    expect(timeBox.x).toBeGreaterThanOrEqual(fieldBox.x);
    expect(timeBox.x + timeBox.width).toBeLessThanOrEqual(fieldBox.x + fieldBox.width);
    await page.getByRole("button", { name: /SAVE DAY/ }).click();
    await expect(page.getByRole("status")).toContainText("Day saved");

    await page.getByRole("button", { name: "WEEK" }).click();
    await expect(page.getByRole("region", { name: "Weekly overview" })).toBeVisible();
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 390);

    await page.getByRole("button", { name: "MONTH" }).click();
    await expect(page.getByRole("region", { name: "Monthly overview" })).toBeVisible();
    const noHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(noHorizontalOverflow).toBe(true);

    await page.getByRole("region", { name: "Monthly overview" }).getByRole("button").filter({ hasText: String(new Date().getDate()) }).first().click();
    await expect(page.getByRole("button", { name: "LOG" })).toHaveClass(/active/);
    await expect(page.getByRole("radio", { name: "Great" })).toHaveAttribute("aria-checked", "true");

    await page.setViewportSize({ width: 320, height: 700 });
    await expect(page.getByRole("navigation", { name: "Mobile tracker view" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Great" })).toBeVisible();
    const narrowFieldBox = await timeField.boundingBox();
    const narrowTimeBox = await timeInput.boundingBox();
    expect(narrowTimeBox.x).toBeGreaterThanOrEqual(narrowFieldBox.x);
    expect(narrowTimeBox.x + narrowTimeBox.width).toBeLessThanOrEqual(narrowFieldBox.x + narrowFieldBox.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(runtimeErrors).toEqual([]);
  });
});
