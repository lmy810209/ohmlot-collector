import { test } from "node:test";
import assert from "node:assert/strict";
import { missingDates, snapshotDates } from "../lib/data.ts";

// 작업4 §1: GitHub Actions drops scheduled runs outright under load sometimes, not just delays them — a gap
// in the daily snapshot record must show up somewhere, not get swallowed into "N daily snapshots". These
// test the pure gap-finder directly (no fixture data dir needed — see lib/data.ts's own comment on why).

test("missingDates: an unbroken run of dates has no gaps", () => {
  assert.deepEqual(missingDates(["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"]), []);
});

test("missingDates: finds a single missing day in the middle", () => {
  assert.deepEqual(missingDates(["2026-09-22", "2026-09-23", "2026-09-25"]), ["2026-09-24"]);
});

test("missingDates: finds a multi-day gap", () => {
  assert.deepEqual(missingDates(["2026-10-01", "2026-10-05"]), ["2026-10-02", "2026-10-03", "2026-10-04"]);
});

test("missingDates: input order doesn't matter, dates are sorted first", () => {
  assert.deepEqual(missingDates(["2026-09-25", "2026-09-22", "2026-09-23"]), ["2026-09-24"]);
});

test("missingDates: duplicate dates collapse, don't create phantom gaps", () => {
  assert.deepEqual(missingDates(["2026-09-22", "2026-09-22", "2026-09-23"]), []);
});

test("missingDates: zero or one date is too little to have a gap — never reports one", () => {
  assert.deepEqual(missingDates([]), []);
  assert.deepEqual(missingDates(["2026-09-22"]), []);
});

test("missingDates: never reports a date before the first or after the last", () => {
  const r = missingDates(["2026-09-23", "2026-09-24"]);
  assert.ok(!r.includes("2026-09-22"));
  assert.ok(!r.includes("2026-09-25"));
});

// Sanity check against the real catalog (lib/data.ts reads ../data by default under `npm test`): as of this
// commit, Sep 22 - Oct 6 is confirmed gap-free by directly counting data/prices/*.jsonl files, so this must
// stay empty — if it isn't, either a real gap appeared (investigate before shipping) or the detector broke.
test("missingDates: the real catalog's own snapshot record has no gaps right now", () => {
  assert.deepEqual(missingDates(snapshotDates()), []);
});
