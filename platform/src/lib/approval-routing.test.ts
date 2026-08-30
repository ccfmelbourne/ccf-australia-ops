import test from "node:test";
import assert from "node:assert/strict";
import { getTier, getRequiredApproverRoles } from "./approval-routing.ts";

test("getTier boundaries", () => {
  assert.equal(getTier(0), 1);
  assert.equal(getTier(500), 1);
  assert.equal(getTier(500.01), 2);
  assert.equal(getTier(2000), 2);
  assert.equal(getTier(2000.01), 3);
  assert.equal(getTier(5000), 3);
  assert.equal(getTier(5000.01), 4);
  assert.equal(getTier(50000), 4);
});

test("getRequiredApproverRoles matches the confirmed tier rules", () => {
  assert.deepEqual(getRequiredApproverRoles(1), ["MINISTRY_OVERSEER"]);
  assert.deepEqual(getRequiredApproverRoles(2), ["MINISTRY_OVERSEER", "COS1"]);
  assert.deepEqual(getRequiredApproverRoles(3), ["COS1", "COS2", "FINANCE_OVERSEER"]);
  assert.deepEqual(getRequiredApproverRoles(4), [
    "COS1",
    "COS2",
    "FINANCE_OVERSEER",
    "REGIONAL_DIRECTOR",
  ]);
});
