import test from "node:test";
import assert from "node:assert/strict";

import { dateParts, entryTone, flattenDays, formatEntry } from "./lib.mjs";

test("flattens API weeks without changing day order", () => {
  assert.deepEqual(flattenDays([[{ day: 1 }, { day: 2 }], [{ day: 3 }]]), [
    { day: 1 }, { day: 2 }, { day: 3 },
  ]);
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
  assert.equal(formatEntry({ duration_minutes: 95 }, { tracker_type: "duration" }), "1h 35m");
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
