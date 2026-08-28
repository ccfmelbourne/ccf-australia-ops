import test from "node:test";
import assert from "node:assert/strict";
import {
  REQUEST_TYPES,
  REQUEST_TYPE_LABELS,
  MINISTRY_TYPES,
  MINISTRY_TYPE_LABELS,
} from "./request-types.ts";

test("every RequestType value has a label", () => {
  for (const value of REQUEST_TYPES) {
    assert.ok(REQUEST_TYPE_LABELS[value], `missing label for ${value}`);
  }
});

test("every MinistryType value has a label", () => {
  for (const value of MINISTRY_TYPES) {
    assert.ok(MINISTRY_TYPE_LABELS[value], `missing label for ${value}`);
  }
});
