/**
 * CCF Reimbursement Voucher — configuration template.
 *
 * This file documents the shape every config.*.js must have. It is NOT
 * loaded by index.html directly — copy it if you're creating a new
 * environment config (e.g. config.production.js), then have index.html
 * load that file explicitly.
 *
 * Naming note: avoid the exact suffix "*.test.js" for any config file —
 * Node's built-in test runner (`node --test`) auto-discovers and tries to
 * execute any file matching that pattern. The pilot's TEST config is
 * therefore named config.pilot.js, not config.test.js.
 *
 * IMPORTANT — there are no real secrets possible here: this is a 100%
 * client-side, static-HTML app with no server, so anything in a config
 * file loaded by the browser is inherently visible to anyone who opens
 * the page (view-source, devtools, network tab). "Keep production
 * separate" is about not accidentally emailing real people real bank
 * details during a test — NOT about hiding an API key, because there
 * isn't one.
 *
 * That said, config.production.js (once it exists) will contain real
 * individuals' personal email addresses, which is personal data even if
 * not a secret — it is git-ignored (see .gitignore) so it never enters
 * version control. Distribute it to the production deployment out of
 * band (e.g. paste directly into the hosting provider at deploy time).
 */
window.CCF_CONFIG = {
  // 'TEST' or 'PRODUCTION'. app.js refuses to initialize on any other
  // value. This is a deliberate hard stop — a config file must
  // unambiguously declare which environment it is.
  ENVIRONMENT: 'TEST',

  // Formspree endpoint this environment submits to. Must be a form you
  // (or CCF Finance) control in the relevant Formspree account — TEST and
  // PRODUCTION must NEVER point at the same Formspree form.
  FORMSPREE_ENDPOINT: 'https://formspree.io/f/REPLACE_WITH_FORM_ID',

  // Prepended to the email subject line sent by Formspree, so recipients
  // can never mistake a test submission for a real one at a glance.
  SUBJECT_PREFIX: '',

  // Lowercased full name -> email address, used only to auto-fill the
  // "Approver Email" field when a requester types a matching name.
  // In TEST config this MUST NOT contain real approvers' personal
  // addresses — use addresses the pilot testers actually control.
  APPROVER_EMAIL_DIRECTORY: {
    // 'joel jerez': 'someone@example.org',
  },
};
