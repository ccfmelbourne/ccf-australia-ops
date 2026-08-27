import test from "node:test";
import assert from "node:assert/strict";
import {
  getAllowedNextStatuses,
  isValidTransition,
  assertValidTransition,
} from "./status-transitions.ts";

test("READY_FOR_PROCESSING can move to PROCESSING, NEEDS_CLARIFICATION, or REJECTED_RETURNED", () => {
  assert.deepEqual(getAllowedNextStatuses("READY_FOR_PROCESSING"), [
    "PROCESSING",
    "NEEDS_CLARIFICATION",
    "REJECTED_RETURNED",
  ]);
});

test("PROCESSING can move to PROCESSED", () => {
  assert.ok(isValidTransition("PROCESSING", "PROCESSED"));
});

test("PROCESSED and REJECTED_RETURNED are terminal", () => {
  assert.deepEqual(getAllowedNextStatuses("PROCESSED"), []);
  assert.deepEqual(getAllowedNextStatuses("REJECTED_RETURNED"), []);
});

test("NEEDS_CLARIFICATION can resume to READY_FOR_PROCESSING or PROCESSING without re-approval", () => {
  assert.ok(isValidTransition("NEEDS_CLARIFICATION", "READY_FOR_PROCESSING"));
  assert.ok(isValidTransition("NEEDS_CLARIFICATION", "PROCESSING"));
});

test("invalid transitions are rejected", () => {
  assert.ok(!isValidTransition("READY_FOR_PROCESSING", "PROCESSED"));
  assert.ok(!isValidTransition("PROCESSED", "PROCESSING"));
});

test("assertValidTransition throws a descriptive error for an invalid move", () => {
  assert.throws(
    () => assertValidTransition("PROCESSED", "PROCESSING"),
    /Invalid Finance status transition: PROCESSED -> PROCESSING/,
  );
});

test("assertValidTransition does not throw for a valid move", () => {
  assert.doesNotThrow(() => assertValidTransition("READY_FOR_PROCESSING", "PROCESSING"));
});
