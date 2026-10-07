import { test } from "node:test";
import assert from "node:assert/strict";
import { unchangedStreakDays } from "../lib/data.ts";

// 작업2.6 §3: "no change" is a collected fact too — these pin down exactly what counts as a streak.

test("unchangedStreakDays: every day the same price is the whole streak", () => {
  assert.equal(unchangedStreakDays([429, 429, 429, 429]), 4);
});

test("unchangedStreakDays: counts only the trailing run at today's price, not the whole array", () => {
  assert.equal(unchangedStreakDays([399, 429, 409, 409, 409]), 3);
});

test("unchangedStreakDays: a price that just changed today has a streak of 1", () => {
  assert.equal(unchangedStreakDays([429, 429, 429, 409]), 1);
});

test("unchangedStreakDays: a single day on file is trivially unchanged for 1 day", () => {
  assert.equal(unchangedStreakDays([429]), 1);
});

test("unchangedStreakDays: no data at all is 0, never invented", () => {
  assert.equal(unchangedStreakDays([]), 0);
});

test("unchangedStreakDays: an earlier matching value that isn't contiguous with today doesn't extend the streak", () => {
  // 429 (day1) -> 409 (day2) -> 429 (day3, back to day1's price) -> 429 (day4): streak is 2, not 3 —
  // day2's 409 breaks the run even though day1 and day3/4 share a value.
  assert.equal(unchangedStreakDays([429, 409, 429, 429]), 2);
});
