const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../js/approval-rules.js');

test('getTier — boundary values for every tier', () => {
  assert.equal(rules.getTier(0), 1);
  assert.equal(rules.getTier(1), 1);
  assert.equal(rules.getTier(500), 1);
  assert.equal(rules.getTier(500.01), 2);
  assert.equal(rules.getTier(1000), 2);
  assert.equal(rules.getTier(2000), 2);
  assert.equal(rules.getTier(2000.01), 3);
  assert.equal(rules.getTier(3500), 3);
  assert.equal(rules.getTier(5000), 3);
  assert.equal(rules.getTier(5000.01), 4);
  assert.equal(rules.getTier(50000), 4);
});

test('getRequiredApprovers — Tier 1 (<= $500)', () => {
  assert.deepEqual(rules.getRequiredApprovers(1, null), ['ministry-overseer']);
});

test('getRequiredApprovers — Tier 2 (> $500 to $2,000)', () => {
  assert.deepEqual(rules.getRequiredApprovers(2, null), ['ministry-overseer', 'cos1']);
});

test('getRequiredApprovers — Tier 3 (> $2,000 to $5,000)', () => {
  assert.deepEqual(rules.getRequiredApprovers(3, null), ['cos1', 'cos2', 'finance-overseer']);
});

test('getRequiredApprovers — Tier 4 (> $5,000), non-Oceana group', () => {
  ['admin', 'finance', 'b1g', 'comms', null, undefined].forEach((group) => {
    const required = rules.getRequiredApprovers(4, group);
    assert.deepEqual(required, ['cos1', 'cos2', 'finance-overseer']);
    assert.ok(!required.includes('regional-dir'), `regional-dir should not be required for group=${group}`);
  });
});

test('getRequiredApprovers — Tier 4 (> $5,000), Oceana group requires Regional Director', () => {
  const required = rules.getRequiredApprovers(4, 'oceana');
  assert.deepEqual(required, ['cos1', 'cos2', 'finance-overseer', 'regional-dir']);
});

test('getApprovalGroup — every "Ministry Type" option maps to its documented approver group', () => {
  assert.equal(rules.getApprovalGroup('Admin'), 'admin');
  assert.equal(rules.getApprovalGroup('Exalt / Live Prod'), 'admin');
  assert.equal(rules.getApprovalGroup('Finance'), 'finance');
  assert.equal(rules.getApprovalGroup('NxtGen'), 'finance');
  assert.equal(rules.getApprovalGroup('Pastoral Care'), 'finance');
  assert.equal(rules.getApprovalGroup('B1G'), 'b1g');
  assert.equal(rules.getApprovalGroup('Elevate'), 'b1g');
  assert.equal(rules.getApprovalGroup('Events / Host'), 'b1g');
  assert.equal(rules.getApprovalGroup('Comms / Media / DGM'), 'comms');
  assert.equal(rules.getApprovalGroup('Oceana Regional'), 'oceana');
});

test('getApprovalGroup — unmapped or empty value returns null (no silent fallback)', () => {
  assert.equal(rules.getApprovalGroup(''), null);
  assert.equal(rules.getApprovalGroup('Not A Real Ministry Type'), null);
  assert.equal(rules.getApprovalGroup('bendigo'), null); // the physical-location field's values must NOT match
  assert.equal(rules.getApprovalGroup('geelong'), null);
  assert.equal(rules.getApprovalGroup('south-east'), null);
  assert.equal(rules.getApprovalGroup('tottenham'), null);
});

test('APPROVERS_BY_MINISTRY — every approval group referenced by the mapping has reference data', () => {
  const groups = new Set(Object.values(rules.MINISTRY_TYPE_TO_APPROVAL_GROUP));
  groups.forEach((group) => {
    assert.ok(rules.APPROVERS_BY_MINISTRY[group], `missing APPROVERS_BY_MINISTRY entry for group "${group}"`);
  });
});

test('end-to-end regression: Oceana Regional > $5,000 triggers the Regional Director requirement', () => {
  const total = 5000.01;
  const tier = rules.getTier(total);
  const group = rules.getApprovalGroup('Oceana Regional');
  const required = rules.getRequiredApprovers(tier, group);
  assert.equal(tier, 4);
  assert.equal(group, 'oceana');
  assert.ok(required.includes('regional-dir'), 'Regional Director must be required for Oceana > $5,000 — this was the confirmed bug in the original app');
});

test('end-to-end regression: non-Oceana ministry type > $5,000 does NOT require Regional Director', () => {
  const total = 12000;
  const tier = rules.getTier(total);
  const group = rules.getApprovalGroup('Admin');
  const required = rules.getRequiredApprovers(tier, group);
  assert.equal(tier, 4);
  assert.equal(group, 'admin');
  assert.ok(!required.includes('regional-dir'));
});
