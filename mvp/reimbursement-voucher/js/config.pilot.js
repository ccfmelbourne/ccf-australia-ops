/**
 * CCF Reimbursement Voucher — TEST environment configuration.
 *
 * This is the ONLY config index.html loads right now. There is no
 * config.production.js in this repo (see js/config.example.js for why,
 * and .gitignore — a production config would contain real people's
 * personal email addresses and must never be committed).
 *
 * APPROVER_EMAIL_DIRECTORY contains only the pilot coordinator's own
 * inbox (a real address, but one the pilot coordinator controls — not a
 * real approver's personal address). Testers can still type any name/
 * email manually; this directory only drives the autofill convenience.
 */
window.CCF_CONFIG = {
  ENVIRONMENT: 'TEST',

  // Dedicated Formspree form created for this pilot test.
  FORMSPREE_ENDPOINT: 'https://formspree.io/f/xoeazlyp',

  SUBJECT_PREFIX: '[TEST — CCF Reimbursement Pilot] ',

  // TEST ONLY. Every address here must be an inbox the pilot test group
  // actually controls (e.g. the pilot coordinator's own address, or
  // addresses of testers who explicitly agreed to receive test
  // notifications) — never a real approver's personal email.
  APPROVER_EMAIL_DIRECTORY: {
    'cos melbourne': 'cosccfmelbourne@gmail.com',
  },
};
