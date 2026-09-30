import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtTime } from "../lib/format.ts";

// task-runtime-label.md §1: the home card prints when collection actually happened (from a price row's
// observed_at), never the scheduled-but-never-honored cron time.

test("fmtTime: a full ISO instant becomes 'HH:MM UTC', zero-padded", () => {
  assert.equal(fmtTime("2026-09-28T05:26:11.488Z"), "05:26 UTC");
  assert.equal(fmtTime("2026-09-29T00:03:00.000Z"), "00:03 UTC");
  assert.equal(fmtTime("2026-09-29T23:59:59.999Z"), "23:59 UTC");
});

test("fmtTime: unparseable input returns null, never a guessed time", () => {
  assert.equal(fmtTime("not a date"), null);
  assert.equal(fmtTime(""), null);
});
