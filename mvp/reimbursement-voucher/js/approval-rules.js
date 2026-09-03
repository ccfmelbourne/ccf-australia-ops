/**
 * CCF Australia — Disbursement Voucher approval rules.
 *
 * Pure, dependency-free logic (no DOM access) so it can be:
 *   - loaded directly in the browser via <script src="js/approval-rules.js">
 *     (attaches to window.CCFApprovalRules), and
 *   - required() from Node for automated tests with zero npm dependencies.
 *
 * Business rules mirror the on-page "Approval Limits" box and the
 * "Ministry COS / Overseer Reference" table in index.html — this file must
 * stay in sync with that table if the reference data ever changes.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CCFApprovalRules = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // The "Ministry Type" field (select id="area" in index.html) is the field
  // that actually determines which approver group applies — its 10 options
  // map onto the 5 approver groups shown in the Ministry COS/Overseer
  // Reference table. (The separately-named "Area" field, select
  // id="ministryType", holds a physical location — Bendigo/Geelong/South
  // East/Tottenham — and does NOT determine approver routing.)
  //
  // Fix for the assessment finding: the original code looked up approvers
  // using the physical-location field's value, which never matched any key
  // in APPROVERS_BY_MINISTRY — so approver names never populated and the
  // Oceana Regional Director requirement could never trigger. This mapping
  // restores the routing to the field that actually corresponds to the
  // reference table below.
  var MINISTRY_TYPE_TO_APPROVAL_GROUP = {
    'Admin': 'admin',
    'Exalt / Live Prod': 'admin',
    'Finance': 'finance',
    'NxtGen': 'finance',
    'Pastoral Care': 'finance',
    'B1G': 'b1g',
    'Elevate': 'b1g',
    'Events / Host': 'b1g',
    'Comms / Media / DGM': 'comms',
    'Oceana Regional': 'oceana',
  };

  // Mirrors the "Ministry COS / Overseer Reference" table in index.html.
  var APPROVERS_BY_MINISTRY = {
    admin: { cos1: 'Alex Approver', cos2: '—', finance: '—', regional: '—', overseer: 'Alex Approver' },
    finance: { cos1: 'Jordan Reyes', cos2: '—', finance: '—', regional: '—', overseer: 'Jordan Reyes' },
    b1g: { cos1: 'Morgan Cruz', cos2: 'Casey Reyes / Riley Navarro', finance: '—', regional: '—', overseer: 'Morgan Cruz' },
    comms: { cos1: 'Taylor Santos', cos2: 'Sam Delgado', finance: '—', regional: '—', overseer: 'Taylor Santos' },
    oceana: { cos1: 'Ptr. Robin Domingo', cos2: '—', finance: '—', regional: 'Ptr. Robin Domingo', overseer: 'Ptr. Robin Domingo' },
  };

  var TIER_LABELS = {
    1: 'Tier 1 — ≤ $500',
    2: 'Tier 2 — > $500 to $2,000',
    3: 'Tier 3 — > $2,000 to $5,000',
    4: 'Tier 4 — > $5,000',
  };

  // Approval Limits box: ≤500 / >500-2000 / >2000-5000 / >5000
  function getTier(total) {
    if (total <= 500) return 1;
    if (total <= 2000) return 2;
    if (total <= 5000) return 3;
    return 4;
  }

  // ministryTypeValue is the raw value of the "Ministry Type" select
  // (e.g. "Admin", "Oceana Regional"). Returns one of
  // 'admin' | 'finance' | 'b1g' | 'comms' | 'oceana', or null if unmapped.
  function getApprovalGroup(ministryTypeValue) {
    return MINISTRY_TYPE_TO_APPROVAL_GROUP[ministryTypeValue] || null;
  }

  // Approval Limits box:
  //   ≤$500              → 1 Ministry Overseer
  //   >$500 to $2,000     → 1 Ministry Overseer + 1 COS
  //   >$2,000 to $5,000   → 2 COS + Finance Overseer
  //   >$5,000             → 2 COS + Finance Overseer (+ Regional Director if Oceana)
  function getRequiredApprovers(tier, approvalGroup) {
    if (tier === 1) return ['ministry-overseer'];
    if (tier === 2) return ['ministry-overseer', 'cos1'];
    if (tier === 3) return ['cos1', 'cos2', 'finance-overseer'];
    if (approvalGroup === 'oceana') return ['cos1', 'cos2', 'finance-overseer', 'regional-dir'];
    return ['cos1', 'cos2', 'finance-overseer'];
  }

  return {
    MINISTRY_TYPE_TO_APPROVAL_GROUP: MINISTRY_TYPE_TO_APPROVAL_GROUP,
    APPROVERS_BY_MINISTRY: APPROVERS_BY_MINISTRY,
    TIER_LABELS: TIER_LABELS,
    getTier: getTier,
    getApprovalGroup: getApprovalGroup,
    getRequiredApprovers: getRequiredApprovers,
  };
});
