import test from "node:test";
import assert from "node:assert/strict";

import {
  apiBaseUrl,
  canonicalDevelopmentUrl,
  dateParts,
  durationHoursFromMinutes,
  durationMinutesFromHours,
  entryTone,
  findSocialProvider,
  flattenDays,
  formatEntry,
  summarizeTrackers,
  updateMonthEntry,
} from "./lib.mjs";
import { isBackendPath } from "./server.mjs";

test("resolves API URLs for local IPv4, IPv6, and deployed frontends", () => {
  assert.equal(
    apiBaseUrl("", { protocol: "http:", hostname: "localhost" }),
    "http://localhost:8000/api/v1",
  );
  assert.equal(
    apiBaseUrl("", { protocol: "http:", hostname: "[::]" }),
    "http://localhost:8000/api/v1",
  );
  assert.equal(
    apiBaseUrl("", { protocol: "https:", hostname: "tracked.example" }),
    "/api/v1",
  );
  assert.equal(
    apiBaseUrl("https://api.example/v1/", { protocol: "http:", hostname: "[::]" }),
    "http://localhost:8000/api/v1",
  );
  assert.equal(
    apiBaseUrl("https://api.example/v1/", { protocol: "http:", hostname: "localhost" }),
    "http://localhost:8000/api/v1",
  );
  assert.equal(
    apiBaseUrl("https://api.example/v1/", { protocol: "https:", hostname: "tracked.example" }),
    "https://api.example/v1",
  );
});

test("uses the same-origin API path in production", () => {
  assert.equal(
    apiBaseUrl("/api/v1", new URL("https://tracked.zohirhamid.com/")),
    "/api/v1",
  );
});

test("proxies only API and OAuth account routes", () => {
  assert.equal(isBackendPath("/api/v1/auth/csrf/?fresh=1"), true);
  assert.equal(isBackendPath("/accounts/google/login/callback/"), true);
  assert.equal(isBackendPath("/assets/index.js"), false);
  assert.equal(isBackendPath("/api-documentation"), false);
});

test("canonicalizes development host aliases for OAuth origin matching", () => {
  assert.equal(
    canonicalDevelopmentUrl({ hostname: "[::]", href: "http://[::]:5173/?next=home" }),
    "http://localhost:5173/?next=home",
  );
  assert.equal(
    canonicalDevelopmentUrl({ hostname: "localhost", href: "http://localhost:5173/" }),
    null,
  );
});

test("flattens API weeks without changing day order", () => {
  assert.deepEqual(flattenDays([[{ day: 1 }, { day: 2 }], [{ day: 3 }]]), [
    { day: 1 }, { day: 2 }, { day: 3 },
  ]);
});

test("updates one entry and summary in cached month data", () => {
  const month = {
    weeks: [[{ date: "2026-10-18", entries: { 1: { rating_value: 2 } } }]],
    summaries: [{ tracker_id: 1, display: "2.0/5", count: 1 }],
  };
  const entry = { id: 9, rating_value: 4 };
  const summary = { tracker_id: 1, display: "4.0/5", count: 1 };

  assert.equal(updateMonthEntry(month, "2026-10-18", 1, entry, summary), true);
  assert.equal(month.weeks[0][0].entries[1], entry);
  assert.equal(month.summaries[0], summary);

  assert.equal(updateMonthEntry(month, "2026-10-18", 1, null, { ...summary, count: 0 }), true);
  assert.equal(month.weeks[0][0].entries[1], undefined);
  assert.equal(month.summaries[0].count, 0);
});

test("finds a provider in the allauth public config", () => {
  const google = findSocialProvider({
    data: {
      socialaccount: {
        providers: [
          { id: "github", client_id: "github-id" },
          { id: "google", client_id: "google-id", flows: ["provider_token"] },
        ],
      },
    },
  }, "google");

  assert.equal(google.client_id, "google-id");
  assert.equal(findSocialProvider({}, "google"), null);
});

test("parses ISO calendar dates in local time", () => {
  const date = dateParts("2026-10-01");
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 9);
  assert.equal(date.getDate(), 1);
});

test("formats every tracker value type", () => {
  assert.equal(formatEntry({ binary_value: true }, { tracker_type: "binary" }), "YES");
  assert.equal(formatEntry({ number_value: "1234.50" }, { tracker_type: "number", unit: "steps" }), "1,234.5 steps");
  assert.equal(formatEntry({ time_value: "07:30:00" }, { tracker_type: "time" }), "07:30");
  assert.equal(formatEntry({ duration_minutes: 450 }, { tracker_type: "duration" }), "7.5h");
  assert.equal(formatEntry({ text_value: "Focused" }, { tracker_type: "text" }), "Focused");
  assert.equal(formatEntry({ rating_value: 4 }, { tracker_type: "rating", max_value: 5 }), "4/5");
  assert.equal(
    formatEntry(
      { prayer_values: { fajr: true, dhuhr: true, asr: false, maghrib: true, isha: null } },
      { tracker_type: "prayer" },
    ),
    "3/4",
  );
});

test("converts decimal duration hours to minute storage and back", () => {
  assert.equal(durationMinutesFromHours("9.2"), 552);
  assert.equal(durationHoursFromMinutes(552), 9.2);
  assert.equal(durationMinutesFromHours("7.5"), 450);
  assert.equal(durationHoursFromMinutes(450), 7.5);
});

test("builds summaries for only the visible week", () => {
  const trackers = [
    { id: 1, tracker_type: "rating", max_value: 5 },
    { id: 2, tracker_type: "text" },
  ];
  const days = [
    { entries: { 1: { rating_value: 3 }, 2: { text_value: "Focused" } } },
    { entries: { 1: { rating_value: 5 } } },
  ];

  assert.deepEqual(summarizeTrackers(trackers, days), [
    { tracker_id: 1, count: 2, display: "4.0/5" },
    { tracker_id: 2, count: 1, display: "1 note" },
  ]);
});

test("assigns semantic tones to binary, rating, and prayer entries", () => {
  assert.equal(entryTone({ binary_value: false }, { tracker_type: "binary" }), "bad");
  assert.equal(entryTone({ rating_value: 3 }, { tracker_type: "rating", min_value: 1, max_value: 5 }), "warn");
  assert.equal(
    entryTone(
      { prayer_values: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: false } },
      { tracker_type: "prayer" },
    ),
    "good",
  );
});

test("assigns good and bad tones from custom tracker colour rules", () => {
  assert.equal(entryTone({ number_value: "8" }, { tracker_type: "number", color_rule: { operator: "gte", value: 10 } }), "bad");
  assert.equal(entryTone({ duration_minutes: 480 }, { tracker_type: "duration", color_rule: { operator: "gte", value: 7.5 } }), "good");
  assert.equal(entryTone({ time_value: "22:15:00" }, { tracker_type: "time", color_rule: { operator: "lte", value: "22:30" } }), "good");
  assert.equal(entryTone({ text_value: "Deep focus session" }, { tracker_type: "text", color_rule: { operator: "contains", value: "focus" } }), "good");
  assert.equal(entryTone({ prayer_values: { fajr: true, dhuhr: true, asr: false, maghrib: true, isha: false } }, { tracker_type: "prayer", color_rule: { operator: "gte", value: 4 } }), "bad");
});
