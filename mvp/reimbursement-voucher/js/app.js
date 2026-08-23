/**
 * CCF Reimbursement Voucher — pilot MVP app logic.
 *
 * Depends on (loaded before this file, see index.html):
 *   - js/approval-rules.js  -> window.CCFApprovalRules
 *   - js/config.pilot.js    -> window.CCF_CONFIG (ENVIRONMENT: 'TEST')
 *
 * PILOT SCOPE NOTE: this file intentionally keeps the original app's
 * shape (vanilla JS, no build step, no framework). Changes here are the
 * minimum needed to close the CRITICAL/HIGH findings in
 * docs/mvp/reimbursement-app-assessment.md — not a rewrite.
 */

const RULES = window.CCFApprovalRules;
const CONFIG = window.CCF_CONFIG;

const ALL_APPROVER_DEFS = [
  { id: 'ministry-overseer', title: 'Ministry Overseer', nameKey: 'overseer' },
  { id: 'cos1',              title: 'COS 1',             nameKey: 'cos1' },
  { id: 'cos2',              title: 'COS 2',             nameKey: 'cos2' },
  { id: 'finance-overseer',  title: 'Finance Overseer',  nameKey: 'finance' },
  { id: 'regional-dir',      title: 'Regional Director', nameKey: 'regional' },
];

const APPROVER_TITLES = {
  'ministry-overseer': 'Ministry Overseer',
  'cos1': 'COS 1',
  'cos2': 'COS 2',
  'finance-overseer': 'Finance Overseer',
  'regional-dir': 'Regional Director',
};

// Shown wherever an export/print output would otherwise imply an approver
// signed something. Requester-entered "approver" fields are routing
// information only — see the PILOT NOTE banner in the Approval section.
const PILOT_SIGNATURE_DISCLAIMER =
  'PILOT NOTE: Approver signatures are not collected in this form. Names/emails above are entered by the requester to route the approval request; approval is not final until the approver confirms separately (e.g. by replying to the notification email).';

const DRAFT_STORAGE_KEY = 'ccf_voucher_draft';

// ── ENVIRONMENT GUARD ───────────────────────────────────────────
// A config file must unambiguously declare TEST or PRODUCTION. Anything
// else (missing config, typo, half-edited file) hard-stops the app rather
// than silently behaving like production. This is what keeps TEST and
// PRODUCTION from ever being "accidentally mixed" per the assessment.
function assertValidEnvironment() {
  const env = CONFIG && CONFIG.ENVIRONMENT;
  if (env !== 'TEST' && env !== 'PRODUCTION') {
    document.body.innerHTML =
      '<div style="max-width:640px;margin:80px auto;padding:24px 28px;border:2px solid #dc2626;' +
      'border-radius:12px;background:#fef2f2;color:#7f1d1d;font-family:sans-serif;">' +
      '<h1 style="font-size:16px;margin:0 0 8px;">Configuration error</h1>' +
      '<p style="font-size:13px;line-height:1.6;margin:0;">This app refused to start because ' +
      '<code>window.CCF_CONFIG.ENVIRONMENT</code> is missing or invalid. It must be exactly ' +
      '<code>"TEST"</code> or <code>"PRODUCTION"</code>. Check that <code>js/config.pilot.js</code> ' +
      '(or your config file) is loaded before <code>js/app.js</code> in index.html.</p></div>';
    throw new Error('Invalid or missing CCF_CONFIG.ENVIRONMENT — refusing to initialize.');
  }
  return env;
}

function renderEnvironmentBanner(env) {
  const banner = document.createElement('div');
  const isTest = env === 'TEST';
  banner.style.cssText =
    'max-width:860px;margin:0 auto 12px;padding:10px 18px;border-radius:10px;' +
    'font-family:"DM Sans",sans-serif;font-size:13px;font-weight:700;text-align:center;' +
    'letter-spacing:0.3px;' +
    (isTest
      ? 'background:#fef3c7;border:2px solid #f59e0b;color:#78350f;'
      : 'background:#fee2e2;border:2px solid #dc2626;color:#7f1d1d;');
  banner.textContent = isTest
    ? '⚠ TEST ENVIRONMENT — Pilot testing only. Do not enter real bank details. Submissions do not go to real approvers.'
    : '✓ PRODUCTION';
  document.body.insertBefore(banner, document.body.firstChild);
  document.title = (isTest ? '[TEST] ' : '') + document.title;
}

// ── INIT ─────────────────────────────────────────────────────
function init() {
  const env = assertValidEnvironment();
  renderEnvironmentBanner(env);
  const pilotNoteEl = document.querySelector('#approvalPilotNote .pilot-note-text');
  if (pilotNoteEl) pilotNoteEl.textContent = PILOT_SIGNATURE_DISCLAIMER;
  initLineItems();
  document.getElementById('voucherDate').value = new Date().toISOString().split('T')[0];
  const seq = String(Math.floor(Math.random() * 900) + 100);
  document.getElementById('voucherNo').value = `DV-${new Date().getFullYear()}-${seq}`;
  updateApprovers();
  initSigPad();
}

// ── LINE ITEMS ────────────────────────────────────────────────
function initLineItems() {
  const container = document.getElementById('lineItems');
  container.innerHTML = '';
  for (let i = 1; i <= 11; i++) {
    const row = document.createElement('div');
    row.className = 'line-row';
    row.innerHTML = `
      <span class="line-num">${i}</span>
      <input type="text" placeholder="Description" class="desc-input" oninput="calcTotal()">
      <input type="number" placeholder="0.00" class="amount-input" min="0" step="0.01" oninput="calcTotal(); updateApprovers()">
    `;
    container.appendChild(row);
  }
}

function calcTotal() {
  let total = 0;
  document.querySelectorAll('.amount-input').forEach(i => { total += parseFloat(i.value) || 0; });
  document.getElementById('totalDisplay').textContent = '$ ' + total.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return total;
}

// ── APPROVAL GRID ─────────────────────────────────────────────
function updateApprovers() {
  const total = calcTotal();
  const tier = RULES.getTier(total);
  const ministryTypeValue = document.getElementById('area').value; // "Ministry Type" field
  const group = RULES.getApprovalGroup(ministryTypeValue);
  const required = RULES.getRequiredApprovers(tier, group);
  const names = RULES.APPROVERS_BY_MINISTRY[group] || {};

  const tierMessages = {
    1: '≤ $500 — Ministry Overseer required',
    2: '> $500 to $2,000 — Ministry Overseer + 1 COS required',
    3: '> $2,000 to $5,000 — 2 COS + Finance Overseer required',
    4: '> $5,000 — 2 COS + Finance Overseer required' + (group === 'oceana' ? ' + Regional Director (Oceana)' : ''),
  };
  document.getElementById('approvalNoteText').textContent = total === 0
    ? 'Enter the total amount above to see required approvers.'
    : tierMessages[tier];

  const grid = document.getElementById('approvalGrid');
  const savedEmails = {};
  const savedNames  = {};
  grid.querySelectorAll('.approver-email-input').forEach(inp => { savedEmails[inp.dataset.role] = inp.value; });
  grid.querySelectorAll('.approver-name-input').forEach(inp  => { savedNames[inp.dataset.role]  = inp.value; });
  grid.innerHTML = '';

  ALL_APPROVER_DEFS.forEach(def => {
    const isRequired = required.includes(def.id);
    const nameDisplay = names[def.nameKey] || '';
    const savedEmail  = savedEmails[def.id] || '';
    const savedName   = savedNames[def.id]  || '';

    const card = document.createElement('div');
    card.className = 'approver-card';
    card.style.cssText = `opacity:${isRequired ? '1' : '0.38'}; border-color:${isRequired ? 'var(--teal)' : 'var(--gray-3)'}; background:${isRequired ? 'var(--teal-light)' : 'var(--gray-1)'};`;

    card.innerHTML = `
      <div class="approver-title">
        ${def.title}
        ${isRequired ? '<br><span style="color:var(--red);font-size:8px;letter-spacing:0">● REQUIRED</span>' : ''}
      </div>
      ${nameDisplay && nameDisplay !== '—' ? `<div class="approver-name">${nameDisplay}</div>` : ''}
      ${isRequired ? `
        <div>
          <label style="font-size:9px;font-weight:700;color:var(--teal-mid);letter-spacing:0.8px;text-transform:uppercase;display:block;margin-bottom:3px;">Notify — Approver Email</label>
          <input type="email" class="approver-email-input" data-role="${def.id}"
            placeholder="Enter email address" value="${savedEmail}"
            style="width:100%;border:1.5px solid var(--gray-3);border-radius:5px;padding:6px 8px;font-family:'DM Sans',sans-serif;font-size:12px;color:var(--dark);background:white;"
            oninput="this.style.borderColor=this.value?'var(--teal)':'var(--gray-3)'">
        </div>
        <div style="margin-top:6px;">
          <label style="font-size:9px;font-weight:700;color:var(--teal-mid);letter-spacing:0.8px;text-transform:uppercase;display:block;margin-bottom:3px;">Notify — Approver Name</label>
          <input type="text" class="approver-name-input" data-role="${def.id}"
            placeholder="Full name" value="${savedName}"
            list="approver-names-list"
            style="width:100%;border:1.5px solid var(--gray-3);border-radius:5px;padding:6px 8px;font-family:'DM Sans',sans-serif;font-size:12px;color:var(--dark);background:white;"
            oninput="this.style.borderColor=this.value?'var(--teal)':'var(--gray-3)'; autoFillApproverEmail(this)"
            onchange="autoFillApproverEmail(this)">
        </div>
      ` : `<div style="font-size:11px;color:var(--gray-4);text-align:center;margin-top:4px;">Not required for this tier</div>`}
      <div class="sig-area" style="margin-top:8px;">
        <input type="text" placeholder="Not collected in this pilot" disabled>
        <label>Approver signature (collected outside this system)</label>
        <input type="date" disabled style="margin-top:4px">
        <label>Approval date (collected outside this system)</label>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ── APPROVER EMAIL AUTOFILL (TEST directory only — see js/config.pilot.js) ──
function autoFillApproverEmail(nameInput) {
  const typed = nameInput.value.trim().toLowerCase();
  const card       = nameInput.closest('.approver-card');
  const emailInput = card ? card.querySelector('.approver-email-input') : null;
  const directory  = (CONFIG && CONFIG.APPROVER_EMAIL_DIRECTORY) || {};

  if (!typed || typed.length < 3) {
    if (emailInput && !typed) {
      emailInput.value = '';
      emailInput.style.borderColor = 'var(--gray-3)';
    }
    return;
  }

  let email = directory[typed];

  if (!email) {
    const match = Object.keys(directory).find(k =>
      k.includes(typed) || typed.includes(k.split(' ')[0])
    );
    if (match) email = directory[match];
  }

  if (!email) return;

  if (emailInput) {
    emailInput.value = email;
    emailInput.style.borderColor = 'var(--teal)';
    emailInput.style.background  = '#e0f7f9';
    setTimeout(() => { emailInput.style.background = 'white'; }, 800);
  }
}

function initSigPad() {
  const canvas = document.getElementById('sigCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let drawing = false, lastX = 0, lastY = 0;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
    if (e.touches) return { x: (e.touches[0].clientX - rect.left) * sx, y: (e.touches[0].clientY - rect.top) * sy };
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  function start(e) { e.preventDefault(); drawing = true; const p = getPos(e); lastX = p.x; lastY = p.y; ctx.beginPath(); ctx.arc(lastX, lastY, 0.8, 0, Math.PI * 2); ctx.fillStyle = '#1a1f2e'; ctx.fill(); }
  function move(e) { if (!drawing) return; e.preventDefault(); const p = getPos(e); ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(p.x, p.y); ctx.strokeStyle = '#1a1f2e'; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); lastX = p.x; lastY = p.y; }
  function stop() { drawing = false; }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', stop);
  canvas.addEventListener('mouseleave', stop);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', stop);
}

function clearSig() {
  const c = document.getElementById('sigCanvas');
  c.getContext('2d').clearRect(0, 0, c.width, c.height);
}

function isSigEmpty() {
  const c = document.getElementById('sigCanvas');
  return !c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some(v => v !== 0);
}

// ── VALIDATE ──────────────────────────────────────────────────
function submitForm() {
  const errors = [];
  if (!document.getElementById('voucherDate').value)          errors.push('Voucher date is required.');
  if (!document.getElementById('requestType').value)          errors.push('Request Type is required.');
  if (!document.getElementById('area').value)                 errors.push('Ministry Type is required.');
  if (!document.getElementById('ministryType').value)         errors.push('Area is required.');
  if (calcTotal() === 0)                                       errors.push('At least one line item with an amount is required.');
  if (!document.getElementById('requesterName').value.trim()) errors.push('Requisitioner name is required.');
  if (!document.getElementById('accountName').value.trim())   errors.push('Bank account name is required.');
  if (isSigEmpty())                                            errors.push('Requisitioner signature is required.');

  const emailInputs = document.querySelectorAll('.approver-email-input');
  const nameInputs  = document.querySelectorAll('.approver-name-input');
  const emailRegex  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let missingEmail  = false, invalidEmail = false, missingName = false;

  if (emailInputs.length === 0 && calcTotal() > 0) {
    errors.push('Please select a Ministry Type to load the approval section.');
  } else {
    emailInputs.forEach(inp => {
      if (!inp.value.trim()) missingEmail = true;
      else if (!emailRegex.test(inp.value.trim())) invalidEmail = true;
    });
    nameInputs.forEach(inp => {
      if (!inp.value.trim()) missingName = true;
    });
    if (missingEmail) errors.push('Please enter all required approver email addresses.');
    if (invalidEmail) errors.push('One or more approver email addresses are invalid.');
  }

  if (errors.length > 0) { showToast('⚠️ ' + errors[0], '#dc2626'); return; }
  openModal();
}

// ── MODAL ─────────────────────────────────────────────────────
function openModal() {
  const total = calcTotal();
  const tier = RULES.getTier(total);
  const group = RULES.getApprovalGroup(document.getElementById('area').value);
  const required = RULES.getRequiredApprovers(tier, group);
  const reqType = document.getElementById('requestType');
  const areaEl = document.getElementById('area');
  const ministryEl = document.getElementById('ministryType');

  const descInputs = document.querySelectorAll('.desc-input');
  const amtInputs = document.querySelectorAll('.amount-input');
  const lineRows = [];
  descInputs.forEach((d, i) => {
    const amt = parseFloat(amtInputs[i].value) || 0;
    if (d.value.trim() || amt > 0) lineRows.push({ desc: d.value.trim() || '(no description)', amt });
  });

  const approverEmailRows = [];
  document.querySelectorAll('.approver-email-input').forEach(inp => {
    const role    = inp.dataset.role;
    const nameInp = document.querySelector(`.approver-name-input[data-role="${role}"]`);
    const nameVal = nameInp ? nameInp.value.trim() : '';
    approverEmailRows.push(`
      <div class="summary-row" style="align-items:flex-start;">
        <span class="s-label">${APPROVER_TITLES[role]}</span>
        <span class="s-value" style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;">
          ${nameVal ? `<span style="font-weight:600;color:var(--dark);font-size:12px;">👤 ${escapeHtml(nameVal)}</span>` : ''}
          <span style="display:flex;align-items:center;gap:5px;">
            <span>📧</span>
            <span style="font-family:'DM Mono',monospace;font-size:12px;color:var(--teal-dark);">${escapeHtml(inp.value.trim())}</span>
          </span>
        </span>
      </div>`);
  });

  const itemRows = lineRows.map((r, i) => `
    <tr><td>${i+1}. ${escapeHtml(r.desc)}</td><td>$ ${r.amt.toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>
  `).join('');

  const chips = required.map(id => `<span class="approver-chip">${APPROVER_TITLES[id]}</span>`).join('');

  document.getElementById('modalBody').innerHTML = `
    <div>
      <div class="summary-group-title">📌 Request Details</div>
      <div class="summary-rows">
        <div class="summary-row"><span class="s-label">Voucher No.</span><span class="s-value mono">${escapeHtml(document.getElementById('voucherNo').value) || '—'}</span></div>
        <div class="summary-row"><span class="s-label">Date</span><span class="s-value mono">${document.getElementById('voucherDate').value}</span></div>
        <div class="summary-row"><span class="s-label">Request Type</span><span class="s-value badge">${reqType.options[reqType.selectedIndex].text}</span></div>
        <div class="summary-row"><span class="s-label">Ministry Type</span><span class="s-value">${areaEl.options[areaEl.selectedIndex].text}</span></div>
        <div class="summary-row"><span class="s-label">Area</span><span class="s-value">${ministryEl.options[ministryEl.selectedIndex].text}</span></div>
      </div>
    </div>
    <div>
      <div class="summary-group-title">📄 Description / Items</div>
      <table class="summary-items-table">
        <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div class="summary-total-row">
        <span>TOTAL</span>
        <span>$ ${total.toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
      </div>
    </div>
    <div>
      <div class="summary-group-title">👤 Requisitioner & Bank</div>
      <div class="summary-rows">
        <div class="summary-row"><span class="s-label">Requisitioned By</span><span class="s-value">${escapeHtml(document.getElementById('requesterName').value)}</span></div>
        <div class="summary-row" style="align-items:flex-start;">
          <span class="s-label">Signature</span>
          <img src="${document.getElementById('sigCanvas').toDataURL()}" style="height:50px;border:1px solid var(--gray-3);border-radius:6px;background:var(--gray-1);padding:4px;">
        </div>
        <div class="summary-row"><span class="s-label">Account Name</span><span class="s-value">${escapeHtml(document.getElementById('accountName').value)}</span></div>
        <div class="summary-row"><span class="s-label">BSB</span><span class="s-value mono">${escapeHtml(document.getElementById('bsb').value) || '—'}</span></div>
        <div class="summary-row"><span class="s-label">Account No.</span><span class="s-value mono">${escapeHtml(document.getElementById('accountNo').value) || '—'}</span></div>
      </div>
    </div>
    <div>
      <div class="summary-group-title">✅ Approval Routing</div>
      <div class="summary-rows">
        <div class="summary-row"><span class="s-label">Approval Tier</span><span class="s-value tier-badge">${RULES.TIER_LABELS[tier]}</span></div>
      </div>
      <div class="approver-chips" style="margin-top:8px;margin-bottom:12px;">${chips}</div>
      <div style="background:var(--gray-1);border:1px solid var(--gray-3);border-radius:var(--radius-sm);padding:12px 14px;">
        <p style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--teal-mid);margin:0 0 10px;">Approval notifications will be sent to</p>
        <div class="summary-rows">${approverEmailRows.join('')}</div>
        <p style="font-size:10.5px;color:var(--gray-5);margin:10px 0 0;line-height:1.5;">${escapeHtml(PILOT_SIGNATURE_DISCLAIMER)}</p>
      </div>
    </div>
  `;

  const btn = document.getElementById('confirmBtn');
  btn.innerHTML = '✓ Confirm & Submit';
  btn.disabled = false;

  document.getElementById('modalOverlay').classList.add('show');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
}

// ── SUBMIT (TEST/PRODUCTION endpoint comes from CCF_CONFIG only) ───────
function confirmSubmit() {
  const endpoint = CONFIG && CONFIG.FORMSPREE_ENDPOINT;
  if (!endpoint || endpoint.indexOf('REPLACE_WITH') !== -1) {
    showToast('❌ Test environment is not configured yet — set FORMSPREE_ENDPOINT in js/config.pilot.js. See docs/mvp/test-environment.md.', '#dc2626');
    return;
  }

  const total = calcTotal();
  const tier = RULES.getTier(total);
  const reqType = document.getElementById('requestType');
  const areaEl = document.getElementById('area');
  const ministryEl = document.getElementById('ministryType');

  const descInputs = document.querySelectorAll('.desc-input');
  const amtInputs = document.querySelectorAll('.amount-input');
  const lineItems = [];
  descInputs.forEach((d, i) => {
    const amt = parseFloat(amtInputs[i].value) || 0;
    if (d.value.trim() || amt > 0) lineItems.push(`${d.value.trim() || '(no description)'} — $${amt.toFixed(2)}`);
  });

  const approverEmails = {};
  const approverNames  = {};
  document.querySelectorAll('.approver-email-input').forEach(inp => {
    approverEmails[APPROVER_TITLES[inp.dataset.role]] = inp.value.trim();
  });
  document.querySelectorAll('.approver-name-input').forEach(inp => {
    approverNames[APPROVER_TITLES[inp.dataset.role]] = inp.value.trim();
  });

  const payload = {
    _subject: `${CONFIG.SUBJECT_PREFIX || ''}CCF Disbursement Voucher — ${document.getElementById('voucherNo').value} | ${reqType.options[reqType.selectedIndex].text}`,
    'Environment':       CONFIG.ENVIRONMENT,
    'Voucher No':        document.getElementById('voucherNo').value,
    'Date':              document.getElementById('voucherDate').value,
    'Request Type':      reqType.options[reqType.selectedIndex].text,
    'Ministry Type':     areaEl.options[areaEl.selectedIndex].text,
    'Area':              ministryEl.options[ministryEl.selectedIndex].text,
    'Requisitioned By':  document.getElementById('requesterName').value,
    'Account Name':      document.getElementById('accountName').value,
    'BSB':               document.getElementById('bsb').value,
    'Account No':        document.getElementById('accountNo').value,
    'Line Items':        lineItems.join('\n'),
    'Total Amount':      `$${total.toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}`,
    'Approval Tier':     RULES.TIER_LABELS[tier],
    'Approver Emails':   Object.entries(approverEmails).map(([k,v]) => `${k}: ${v}`).join('\n'),
    'Approver Names':    Object.entries(approverNames).map(([k,v])  => `${k}: ${v}`).join('\n'),
    'Approval Note':     PILOT_SIGNATURE_DISCLAIMER,
    '_replyto':          document.getElementById('requesterName').value,
  };

  const btn = document.getElementById('confirmBtn');
  btn.innerHTML = '⏳ Sending...';
  btn.disabled = true;

  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(payload),
  })
  .then(r => r.json())
  .then(data => {
    if (data.ok || data.next) {
      closeModal();
      showSuccessBanner();
      // Successful submission means the browser no longer needs the draft,
      // and any saved draft up to this point should not linger locally.
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setTimeout(() => {
        clearForm(true);
        const b = document.getElementById('successBanner');
        if (b) b.style.display = 'none';
      }, 6000);
    } else {
      // Formspree's actual error shape is usually { errors: [{ message, field }] },
      // not a single { error: "..." } string — surface the real reason instead of
      // always falling through to a generic message.
      const detail = data.error
        || (Array.isArray(data.errors) && data.errors.map(e => e.message || e.field).filter(Boolean).join('; '))
        || 'Submission failed. Please try again.';
      throw new Error(detail);
    }
  })
  .catch(err => {
    btn.innerHTML = '✓ Confirm & Submit';
    btn.disabled = false;
    showToast('❌ ' + err.message, '#dc2626');
  });
}

function showSuccessBanner() {
  let b = document.getElementById('successBanner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'successBanner';
    b.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:16px 28px;border-radius:12px;font-size:15px;font-weight:600;box-shadow:0 8px 32px rgba(16,185,129,0.4);z-index:999;display:flex;align-items:center;gap:12px;';
    b.innerHTML = `<span style="font-size:24px;">✅</span><div><div>Voucher submitted successfully!</div><div style="font-size:12px;font-weight:400;opacity:0.85;margin-top:2px;">Notification sent to configured test recipients. Form will reset shortly.</div></div>`;
    document.body.appendChild(b);
  } else { b.style.display = 'flex'; }
}

// ── TOAST ─────────────────────────────────────────────────────
function showToast(msg, bg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = bg || '#1a1f2e';
  t.style.borderRadius = '10px';
  t.style.fontWeight = '500';
  t.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}

// ── CLEAR ─────────────────────────────────────────────────────
function clearForm(silent) {
  if (!silent && !confirm('Clear all form data?')) return;
  document.querySelectorAll('input:not([type=button]), select').forEach(el => {
    if (el.disabled) return;
    if (el.type === 'checkbox') el.checked = false;
    else el.value = '';
  });
  clearSig();
  calcTotal();
  updateApprovers();
  document.getElementById('voucherDate').value = new Date().toISOString().split('T')[0];
  const seq = String(Math.floor(Math.random() * 900) + 100);
  document.getElementById('voucherNo').value = `DV-${new Date().getFullYear()}-${seq}`;
}

// ── DRAFT SAVE / RESTORE ────────────────────────────────────────
// Only non-sensitive fields are persisted to localStorage. Bank account
// name/BSB/account number and the signature image are NEVER written to
// localStorage — see docs/mvp/reimbursement-app-assessment.md (#4, #5, #6).
// Requesters must re-enter bank details and re-sign after a page reload;
// that's a deliberate trade-off for this pilot, not an oversight.
function collectDraftData() {
  const descs = document.querySelectorAll('.desc-input');
  const amts  = document.querySelectorAll('.amount-input');
  const lines = [];
  descs.forEach((d, i) => lines.push({ desc: d.value, amt: amts[i].value }));
  return {
    voucherNo:     document.getElementById('voucherNo').value,
    voucherDate:   document.getElementById('voucherDate').value,
    requestType:   document.getElementById('requestType').value,
    area:          document.getElementById('area').value,
    ministryType:  document.getElementById('ministryType').value,
    requesterName: document.getElementById('requesterName').value,
    lines,
    savedAt: new Date().toISOString(),
  };
}

function saveForm() {
  const data = collectDraftData();
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data));
  showToast('💾 Draft saved to this browser (bank details & signature are never saved — re-enter them before submitting)', '#10b981');
}

function loadSavedForm() {
  const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
  if (!saved) return;
  try {
    const data = JSON.parse(saved);
    if (data.voucherNo)   document.getElementById('voucherNo').value   = data.voucherNo;
    if (data.voucherDate) document.getElementById('voucherDate').value = data.voucherDate;
    if (data.requestType) document.getElementById('requestType').value = data.requestType;
    if (data.area)        { document.getElementById('area').value = data.area; }
    if (data.ministryType){ document.getElementById('ministryType').value = data.ministryType; }
    if (data.lines) {
      const descs = document.querySelectorAll('.desc-input');
      const amts  = document.querySelectorAll('.amount-input');
      data.lines.forEach((l, i) => {
        if (descs[i]) descs[i].value = l.desc || '';
        if (amts[i])  amts[i].value  = l.amt  || '';
      });
      calcTotal();
    }
    if (data.requesterName) document.getElementById('requesterName').value = data.requesterName;
    updateApprovers();
    showToast('✅ Draft restored (bank details & signature are not saved — please re-enter them)', '#10b981');
  } catch(e) { console.warn('Could not load draft', e); }
}

// collectFormData() gathers EVERYTHING needed to submit/export, including
// bank details and the signature — this is only ever held in memory for
// the duration of a submit/export action and is never written to storage.
function collectFormData() {
  const draft = collectDraftData();
  return Object.assign({}, draft, {
    accountName: document.getElementById('accountName').value,
    bsb:         document.getElementById('bsb').value,
    accountNo:   document.getElementById('accountNo').value,
    signature:   document.getElementById('sigCanvas').toDataURL(),
  });
}

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Neutralizes CSV/Excel formula injection (a description/name starting
// with =, +, -, or @ would otherwise execute as a formula when the
// exported file is opened in Excel/Sheets).
function csvSafe(value) {
  const str = String(value == null ? '' : value);
  return /^[=+\-@]/.test(str) ? `'${str}` : str;
}

// ── DOWNLOAD ──────────────────────────────────────────────────
function toggleDownloadMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('downloadMenu');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  document.addEventListener('click', () => { menu.style.display = 'none'; }, { once: true });
}

function downloadForm(format) {
  document.getElementById('downloadMenu').style.display = 'none';
  const data    = collectFormData();
  const total   = calcTotal();
  const tier    = RULES.getTier(total);
  const tierLbl = RULES.TIER_LABELS[tier] || '';
  const voucherNo = data.voucherNo || 'DV';
  const areaText  = document.getElementById('area').options[document.getElementById('area').selectedIndex]?.text || '—';
  const miniText  = document.getElementById('ministryType').options[document.getElementById('ministryType').selectedIndex]?.text || '—';

  const allApproverDefs = [
    { id: 'ministry-overseer', title: 'Ministry Overseer' },
    { id: 'cos1',              title: 'COS 1' },
    { id: 'cos2',              title: 'COS 2' },
    { id: 'finance-overseer',  title: 'Finance Overseer' },
    { id: 'regional-dir',      title: 'Regional Director (Oceana >$5k)' },
  ];
  const approverCards = allApproverDefs.map(def => {
    const emailInp = document.querySelector(`.approver-email-input[data-role="${def.id}"]`);
    const nameInp  = document.querySelector(`.approver-name-input[data-role="${def.id}"]`);
    return {
      title    : def.title,
      required : !!emailInp,
      email    : emailInp ? emailInp.value.trim() : '',
      name     : nameInp  ? nameInp.value.trim()  : '',
      // Signature/date are intentionally never populated in this pilot —
      // see PILOT_SIGNATURE_DISCLAIMER rendered alongside every export.
      signature: '',
      date     : '',
    };
  });

  const filledLines = data.lines.filter(l => l.desc || l.amt);
  const sigData     = data.signature;

  if (format === 'csv') {
    downloadCSV(data, filledLines, total, tierLbl, approverCards, areaText, miniText, voucherNo);
  } else if (format === 'excel') {
    downloadExcel(data, filledLines, total, tierLbl, approverCards, areaText, miniText, voucherNo);
  } else if (format === 'word') {
    downloadWord(data, filledLines, total, tierLbl, approverCards, areaText, miniText, voucherNo, sigData);
  } else if (format === 'pdf') {
    downloadPDF(data, filledLines, total, tierLbl, approverCards, areaText, miniText, voucherNo, sigData);
  } else if (format === 'pdffile') {
    downloadPDFFile(data, filledLines, total, tierLbl, approverCards, areaText, miniText, voucherNo, sigData);
  } else {
    downloadHTML(data, filledLines, total, tierLbl, approverCards, areaText, miniText, voucherNo, sigData);
  }
}

// ── CSV ───────────────────────────────────────────────────────
function downloadCSV(data, lines, total, tierLbl, approvers, areaText, miniText, voucherNo) {
  const rows = [
    ['CCF Australia Melbourne — Disbursement Voucher (PILOT/TEST)'],
    [],
    ['Voucher No', csvSafe(data.voucherNo)],
    ['Date', data.voucherDate],
    ['Request Type', csvSafe(data.requestType)],
    ['Ministry Type', csvSafe(miniText)],
    ['Area', csvSafe(areaText)],
    ['Requisitioned By', csvSafe(data.requesterName)],
    ['Account Name', csvSafe(data.accountName)],
    ['BSB', csvSafe(data.bsb)],
    ['Account No', csvSafe(data.accountNo)],
    ['Approval Tier', csvSafe(tierLbl)],
    [],
    ['#', 'Description', 'Amount (AUD)'],
    ...lines.map((l, i) => [i+1, csvSafe(l.desc), parseFloat(l.amt||0).toFixed(2)]),
    [],
    ['TOTAL', '', total.toFixed(2)],
    [],
    ['APPROVALS (notification routing only — see note below)'],
    ['Role', 'Name', 'Email'],
    ...approvers.filter(a => a.required).map(a => [csvSafe(a.title), csvSafe(a.name), csvSafe(a.email)]),
    [],
    [PILOT_SIGNATURE_DISCLAIMER],
  ];
  const csv  = rows.map(r => r.map(c => '"' + String(c||'').replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  triggerDownload(blob, `CCF_Voucher_${voucherNo}.csv`);
  showToast('📊 CSV downloaded!', '#00A8B4');
}

// ── EXCEL (via HTML table served as .xls, opened natively by Excel) ────
function downloadExcel(data, lines, total, tierLbl, approvers, areaText, miniText, voucherNo) {
  const xlsHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Voucher</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
<body><table border="1">
  <tr bgcolor="#00A8B4"><td colspan="3"><b><font color="white">CCF Australia Melbourne — Disbursement Voucher (PILOT/TEST)</font></b></td></tr>
  <tr><td><b>Voucher No</b></td><td colspan="2">${escapeHtml(data.voucherNo)}</td></tr>
  <tr><td><b>Date</b></td><td colspan="2">${escapeHtml(data.voucherDate)}</td></tr>
  <tr><td><b>Request Type</b></td><td colspan="2">${escapeHtml(data.requestType)}</td></tr>
  <tr><td><b>Ministry Type</b></td><td colspan="2">${escapeHtml(miniText)}</td></tr>
  <tr><td><b>Area</b></td><td colspan="2">${escapeHtml(areaText)}</td></tr>
  <tr><td><b>Requisitioned By</b></td><td colspan="2">${escapeHtml(data.requesterName)}</td></tr>
  <tr><td><b>Account Name</b></td><td colspan="2">${escapeHtml(data.accountName)}</td></tr>
  <tr><td><b>BSB</b></td><td colspan="2">${escapeHtml(data.bsb)}</td></tr>
  <tr><td><b>Account No</b></td><td colspan="2">${escapeHtml(data.accountNo)}</td></tr>
  <tr><td><b>Approval Tier</b></td><td colspan="2">${escapeHtml(tierLbl)}</td></tr>
  <tr><td colspan="3"></td></tr>
  <tr bgcolor="#00A8B4"><td><b><font color="white">#</font></b></td><td><b><font color="white">Description</font></b></td><td><b><font color="white">Amount (AUD)</font></b></td></tr>
  ${lines.map((l,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(l.desc||'')}</td><td>${parseFloat(l.amt||0).toFixed(2)}</td></tr>`).join('')}
  <tr><td colspan="2"><b>TOTAL</b></td><td><b>${total.toFixed(2)}</b></td></tr>
  <tr><td colspan="3"></td></tr>
  <tr bgcolor="#00A8B4"><td colspan="3"><b><font color="white">APPROVALS (notification routing only)</font></b></td></tr>
  <tr><td><b>Role</b></td><td><b>Name</b></td><td><b>Email</b></td></tr>
  ${approvers.filter(a=>a.required).map(a=>`<tr><td>${escapeHtml(a.title)}</td><td>${escapeHtml(a.name)}</td><td>${escapeHtml(a.email)}</td></tr>`).join('')}
  <tr><td colspan="3" style="font-size:10pt;color:#7f1d1d;">${escapeHtml(PILOT_SIGNATURE_DISCLAIMER)}</td></tr>
</table></body></html>`;

  const blob = new Blob([xlsHtml], {type: 'application/vnd.ms-excel'});
  triggerDownload(blob, `CCF_Voucher_${voucherNo}.xls`);
  showToast('📗 Excel downloaded!', '#10b981');
}

// ── WORD (.doc via HTML) ──────────────────────────────────────
function downloadWord(data, lines, total, tierLbl, approvers, areaText, miniText, voucherNo, sigData) {
  const sigHtml = sigData ? `<img src="${sigData}" style="height:50px;border:1px solid #ccc;padding:3px;">` : '<div style="height:40px;border-bottom:1px solid #000;width:200px;">&nbsp;</div>';
  const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8"><title>CCF Disbursement Voucher</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; margin: 2cm; }
  h1   { color: #00A8B4; font-size: 16pt; margin: 0; }
  h2   { color: #00919b; font-size: 10pt; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #00A8B4; padding-bottom: 3px; margin: 14px 0 6px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 10px; }
  th    { background: #00A8B4; color: white; padding: 6px 8px; font-size: 10pt; text-align: left; }
  td    { padding: 5px 8px; border: 1px solid #e2e8f0; font-size: 10pt; }
  .header-block { background: #00A8B4; padding: 14px 18px; color: white; margin-bottom: 16px; }
  .label { font-weight: bold; color: #00919b; font-size: 9pt; }
  .total { background: #e0f7f9; font-weight: bold; color: #007d88; }
  .warn { color: #dc2626; font-weight: bold; font-size: 9pt; }
  .pilot-note { color: #92400e; background: #fffbeb; border: 1px solid #fde68a; padding: 8px 10px; font-size: 9pt; margin-top: 10px; }
</style></head>
<body>
<div class="header-block">
  <h1>CCF Australia — Melbourne</h1>
  <p style="margin:4px 0 0;font-size:10pt;opacity:0.85;">Disbursement Voucher — PILOT/TEST</p>
</div>

<table style="width:100%;border:none;margin-bottom:14px;">
  <tr><td style="border:none;width:50%"><span class="label">VOUCHER NO.</span><br>${escapeHtml(data.voucherNo)||'—'}</td>
      <td style="border:none"><span class="label">DATE</span><br>${escapeHtml(data.voucherDate)||'—'}</td></tr>
  <tr><td style="border:none"><span class="label">REQUEST TYPE</span><br>${escapeHtml(data.requestType)||'—'}</td>
      <td style="border:none"><span class="label">MINISTRY TYPE</span><br>${escapeHtml(miniText)}</td></tr>
  <tr><td style="border:none"><span class="label">AREA</span><br>${escapeHtml(areaText)}</td>
      <td style="border:none"><span class="label">APPROVAL TIER</span><br>${escapeHtml(tierLbl)}</td></tr>
</table>

<p class="warn">⚠ NOTE: One ministry per voucher only. No breaking of total amount for less approval.</p>

<h2>Description / Receipts Attached</h2>
<table>
  <tr><th>#</th><th>Description</th><th style="text-align:right">Amount (AUD)</th></tr>
  ${lines.map((l,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(l.desc||'')}</td><td style="text-align:right">${parseFloat(l.amt||0).toFixed(2)}</td></tr>`).join('')}
  <tr class="total"><td colspan="2" style="text-align:right"><b>TOTAL</b></td><td style="text-align:right"><b>$ ${total.toFixed(2)}</b></td></tr>
</table>

<table style="width:100%;border:none;margin-bottom:14px;">
<tr>
<td style="border:none;vertical-align:top;width:50%;padding-right:12px;">
  <h2>Requisitioned By</h2>
  <p style="font-size:9pt;color:#64748b;">For Cash Advances (CA), the requisitioner agrees to liquidate the CA with invoices, not later than one (1) month from the date of this voucher.</p>
  <p><span class="label">PRINTED NAME</span><br>${escapeHtml(data.requesterName)||'—'}</p>
  <p><span class="label">SIGNATURE</span><br>${sigHtml}</p>
</td>
<td style="border:none;vertical-align:top;">
  <h2>Bank Details for Payment</h2>
  <p><span class="label">ACCOUNT NAME</span><br>${escapeHtml(data.accountName)||'—'}</p>
  <p><span class="label">BSB</span><br>${escapeHtml(data.bsb)||'—'}</p>
  <p><span class="label">ACCOUNT NO.</span><br>${escapeHtml(data.accountNo)||'—'}</p>
</td>
</tr></table>

<h2>Approval — Notification Routing</h2>
<table>
  <tr><th>Role</th><th>Approver Name</th><th>Email</th></tr>
  ${approvers.map(a=>`<tr style="${!a.required?'opacity:0.4;':''}">`+
    `<td><b>${escapeHtml(a.title)}</b></td>`+
    `<td>${escapeHtml(a.name)||'—'}</td><td>${escapeHtml(a.email)||'—'}</td></tr>`).join('')}
</table>
<p class="pilot-note">${escapeHtml(PILOT_SIGNATURE_DISCLAIMER)}</p>

<p class="warn">⛔ No breaking of total amount for less approval.</p>
<p style="font-size:8pt;color:#94a3b8;margin-top:20px;">CCF Australia – Melbourne | Disbursement Voucher | PILOT/TEST — Confidential | Generated: ${new Date().toLocaleString('en-AU')}</p>
</body></html>`;

  const blob = new Blob([wordHtml], {type: 'application/msword'});
  triggerDownload(blob, `CCF_Voucher_${voucherNo}.doc`);
  showToast('📘 Word document downloaded!', '#3b82f6');
}

// ── PDF (print dialog) ────────────────────────────────────────
function downloadPDF(data, lines, total, tierLbl, approvers, areaText, miniText, voucherNo, sigData) {
  const sigHtml = sigData
    ? `<img src="${sigData}" style="max-height:54px;max-width:100%;border:1px solid #e2e8f0;border-radius:5px;background:#f8fafc;padding:3px;display:block;" alt="Signature">`
    : '<div style="height:36px;border-bottom:1.5px solid #00A8B4;width:100%;"></div>';

  const lineRows = lines.map((l, i) => `
    <tr style="background:${i % 2 === 0 ? '#f8fafc' : 'white'}">
      <td style="padding:3px 6px;border-bottom:1px solid #e2e8f0;font-size:7.5pt;color:#94a3b8;width:22px;text-align:center;">${i+1}</td>
      <td style="padding:3px 6px;border-bottom:1px solid #e2e8f0;font-size:7.5pt;">${escapeHtml(l.desc || '')}</td>
      <td style="padding:3px 6px;border-bottom:1px solid #e2e8f0;font-size:7.5pt;text-align:right;font-family:monospace;">$ ${parseFloat(l.amt||0).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
    </tr>`).join('');

  const approverCols = approvers.map(a => `
    <td style="padding:5px 4px;border:1.5px solid ${a.required ? '#00A8B4' : '#e2e8f0'};border-radius:6px;vertical-align:top;background:${a.required ? '#e0f7f9' : '#f8fafc'};width:20%;opacity:${a.required ? '1' : '0.38'};">
      <div style="font-size:7.5pt;font-weight:700;color:#00919b;text-transform:uppercase;letter-spacing:0.8px;text-align:center;line-height:1.4;margin-bottom:4px;">${escapeHtml(a.title)}</div>
      ${a.required ? `
        <div style="font-size:7pt;color:#dc2626;text-align:center;margin-bottom:6px;font-weight:600;">● REQUIRED</div>
        ${a.name  ? `<div style="font-size:8pt;font-weight:600;color:#1a1f2e;text-align:center;margin-bottom:2px;">👤 ${escapeHtml(a.name)}</div>` : ''}
        ${a.email ? `<div style="font-size:7pt;color:#007d88;font-family:monospace;word-break:break-all;text-align:center;margin-bottom:6px;">${escapeHtml(a.email)}</div>` : ''}
        <div style="border-top:1px solid #b2e8ec;padding-top:5px;font-size:6.5pt;color:#92400e;">Signature not collected — pilot</div>
      ` : `<div style="font-size:7.5pt;color:#94a3b8;text-align:center;margin-top:6px;">Not required<br>for this tier</div>`}
    </td>`).join('');

  const ministryTableRows = `
    <tr>
      <td style="background:#00A8B4;color:white;font-weight:700;font-size:8pt;padding:6px 8px;text-transform:uppercase;letter-spacing:0.5px;">Ministry</td>
      <td style="background:#e0f7f9;color:#00919b;font-weight:700;font-size:7.5pt;padding:6px 8px;text-align:center;">ADMIN /<br>EXALT / LIVE</td>
      <td style="background:white;color:#00919b;font-weight:700;font-size:7.5pt;padding:6px 8px;text-align:center;">FINANCE /<br>NXTGEN / PC</td>
      <td style="background:#e0f7f9;color:#00919b;font-weight:700;font-size:7.5pt;padding:6px 8px;text-align:center;">B1G / ELEVATE<br>EVENTS / HOST</td>
      <td style="background:white;color:#00919b;font-weight:700;font-size:7.5pt;padding:6px 8px;text-align:center;">COMMS /<br>MEDIA / DGM</td>
      <td style="background:#e0f7f9;color:#00919b;font-weight:700;font-size:7.5pt;padding:6px 8px;text-align:center;">OCEANA REG. DIR.<br>(> $5,000)</td>
    </tr>
    <tr>
      <td style="background:#00919b;color:white;font-weight:700;font-size:7.5pt;padding:5px 8px;">COS / Overseer</td>
      <td colspan="5" style="background:#00919b;"></td>
    </tr>
    <tr>
      <td style="background:#f8fafc;font-weight:700;color:#00919b;font-size:7.5pt;padding:6px 8px;text-transform:uppercase;">Name</td>
      <td style="background:#f8fafc;font-size:7.5pt;padding:6px 8px;text-align:center;">Ross Callado</td>
      <td style="background:white;font-size:7.5pt;padding:6px 8px;text-align:center;">Joel Jerez</td>
      <td style="background:#f8fafc;font-size:7.5pt;padding:6px 8px;text-align:center;">Vamie Pinlac /<br>Robert Cruz /<br>Joshua Mangalong</td>
      <td style="background:white;font-size:7.5pt;padding:6px 8px;text-align:center;">Dexter Santiago /<br>Moriz Manlangit</td>
      <td style="background:#f8fafc;font-size:7.5pt;padding:6px 8px;text-align:center;">Ptr. Ryan Escobar</td>
    </tr>`;

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>CCF Disbursement Voucher — ${voucherNo}</title>
<style>
  @page { size: A4; margin: 6mm 8mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, sans-serif; font-size: 8pt; color: #1a1f2e; margin: 0; padding: 0; background: white; }
  .header { background: linear-gradient(135deg, #00A8B4, #007d88); color: white; padding: 8px 14px; border-radius: 8px 8px 0 0; display: flex; align-items: center; justify-content: space-between; }
  .header-left { display: flex; align-items: center; gap: 8px; }
  .logo-box { background: white; border-radius: 6px; padding: 3px 5px; }
  .header h1 { margin: 0; font-size: 12pt; font-weight: 700; letter-spacing: -0.3px; }
  .header p  { margin: 1px 0 0; font-size: 7pt; opacity: 0.78; letter-spacing: 1.2px; text-transform: uppercase; }
  .header-meta { text-align: right; }
  .header-meta .meta-label { font-size: 7pt; opacity: 0.65; font-weight: 600; letter-spacing: 1.2px; text-transform: uppercase; display: block; }
  .header-meta .meta-val { font-family: monospace; font-size: 11pt; font-weight: 700; display: block; }
  .form-body { border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px; overflow: hidden; }
  .section { padding: 5px 12px; border-bottom: 1px solid #e2e8f0; }
  .section:last-child { border-bottom: none; }
  .section-title { font-size: 6.5pt; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #00919b; margin-bottom: 5px; display: flex; align-items: center; gap: 6px; }
  .section-title::after { content: ''; flex: 1; height: 1px; background: #e2e8f0; }
  .row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; }
  .field-box { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 4px; padding: 4px 7px; }
  .field-box .flabel { font-size: 7pt; font-weight: 700; color: #64748b; letter-spacing: 0.3px; display: block; margin-bottom: 2px; text-transform: uppercase; }
  .field-box .fval   { font-size: 8.5pt; color: #1a1f2e; font-weight: 500; }
  .notice { background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 4px 10px; font-size: 7pt; color: #92400e; font-weight: 600; }
  .items-table { width: 100%; border-collapse: collapse; }
  .tbl-head { background: #00A8B4; }
  .tbl-head th { color: white; font-size: 7pt; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; padding: 4px 6px; text-align: left; }
  .tbl-head th:last-child { text-align: right; }
  .total-bar { display: flex; justify-content: space-between; align-items: center; background: #e0f7f9; border: 1.5px solid #00A8B4; border-radius: 4px; padding: 5px 10px; margin-top: 4px; }
  .total-bar span:first-child { font-size: 8.5pt; font-weight: 700; color: #007d88; }
  .total-bar span:last-child  { font-family: monospace; font-size: 10pt; font-weight: 700; color: #007d88; }
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .info-box { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 5px; padding: 6px 10px; }
  .info-box h3 { font-size: 6.5pt; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #00919b; margin: 0 0 4px; padding-bottom: 3px; border-bottom: 1px solid #e2e8f0; }
  .info-label { font-size: 7.5pt; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 2px; letter-spacing: 0.3px; }
  .info-val   { font-size: 8pt; color: #1a1f2e; font-weight: 500; margin-bottom: 4px; display: block; }
  .appr-header { background: linear-gradient(135deg, #00A8B4, #007d88); color: white; padding: 5px 12px; font-weight: 700; font-size: 7.5pt; letter-spacing: 0.5px; border-radius: 7px 7px 0 0; }
  .appr-tier   { background: #e0f7f9; border: 1px solid #00A8B4; padding: 4px 10px; border-radius: 0 0 5px 5px; margin-bottom: 5px; font-size: 7.5pt; color: #007d88; font-weight: 600; }
  .appr-tier .tier-badge { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; font-weight: 700; font-size: 8pt; padding: 2px 8px; border-radius: 20px; margin-left: 6px; }
  .appr-grid { display: table; width: 100%; border-collapse: separate; border-spacing: 5px; margin-bottom: 8px; }
  .limits-box { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 5px; padding: 5px 10px; }
  .limits-box h4 { font-size: 7.5pt; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #00919b; margin: 0 0 8px; }
  .limit-row { display: flex; align-items: baseline; gap: 6px; margin-bottom: 2px; font-size: 7pt; }
  .limit-amt  { font-family: monospace; font-weight: 700; color: #007d88; min-width: 100px; font-size: 7pt; }
  .limit-warn { color: #dc2626; font-weight: 700; font-size: 7pt; margin-top: 4px; }
  .min-table { width: 100%; border-collapse: collapse; border-radius: 6px; overflow: hidden; border: 1.5px solid #e2e8f0; }
  .min-table th, .min-table td { border-right: 1px solid rgba(255,255,255,0.2); padding: 4px 6px; font-size: 6.5pt; text-align: center; }
  .min-table td { border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; color: #1a1f2e; }
  .footer { margin-top: 5px; border-top: 1px solid #00A8B4; padding-top: 4px; text-align: center; font-size: 7pt; color: #94a3b8; }
  .pilot-note { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; padding: 5px 10px; font-size: 6.5pt; margin-top: 4px; border-radius: 4px; }
  @media print {
    html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="header-left">
    <div class="logo-box">
      <svg width="56" height="32" viewBox="0 0 110 60" xmlns="http://www.w3.org/2000/svg">
        <circle cx="30" cy="30" r="26" fill="none" stroke="#00A8B4" stroke-width="2.5"/>
        <text x="30" y="36" font-family="Arial,sans-serif" font-weight="900" font-size="16" fill="#00A8B4" text-anchor="middle" letter-spacing="1">ccf</text>
        <text x="62" y="19" font-family="Arial,sans-serif" font-weight="700" font-size="7.5" fill="#00A8B4" letter-spacing="0.5">CHRIST'S</text>
        <text x="62" y="29" font-family="Arial,sans-serif" font-weight="700" font-size="7.5" fill="#00A8B4" letter-spacing="0.5">COMMISSION</text>
        <text x="62" y="39" font-family="Arial,sans-serif" font-weight="700" font-size="7.5" fill="#00A8B4" letter-spacing="0.5">FELLOWSHIP</text>
        <text x="62" y="49" font-family="Arial,sans-serif" font-weight="700" font-size="7.5" fill="#00A8B4" letter-spacing="0.5">AUSTRALIA</text>
      </svg>
    </div>
    <div>
      <h1>CCF Australia</h1>
      <p>Melbourne · Disbursement Voucher — PILOT/TEST</p>
    </div>
  </div>
  <div class="header-meta">
    <span class="meta-label">Voucher No.</span>
    <span class="meta-val">${escapeHtml(voucherNo)}</span>
    <span class="meta-label" style="margin-top:4px;">Date</span>
    <span class="meta-val">${escapeHtml(data.voucherDate) || '—'}</span>
  </div>
</div>

<div class="form-body">
  <div class="section">
    <div class="section-title">Request Details</div>
    <div class="row3">
      <div class="field-box"><span class="flabel">Request Type</span><span class="fval">${escapeHtml(data.requestType) || '—'}</span></div>
      <div class="field-box"><span class="flabel">Ministry Type</span><span class="fval">${escapeHtml(miniText)}</span></div>
      <div class="field-box"><span class="flabel">Area</span><span class="fval">${escapeHtml(areaText)}</span></div>
    </div>
  </div>

  <div class="section" style="padding-top:0;padding-bottom:5px;border-bottom:none;">
    <div class="notice">⚠ NOTE: One ministry per voucher only. No breaking of total amount for less approval.</div>
  </div>

  <div class="section">
    <div class="section-title">Description / Receipts Attached</div>
    <table class="items-table">
      <thead class="tbl-head">
        <tr>
          <th style="width:22px;">#</th>
          <th>Description</th>
          <th style="text-align:right">Amount (AUD)</th>
        </tr>
      </thead>
      <tbody>${lineRows}</tbody>
    </table>
    <div class="total-bar">
      <span>TOTAL</span>
      <span>$ ${total.toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
    </div>
  </div>

  <div class="section">
    <div class="row2">
      <div>
        <div class="section-title">Requisitioned By</div>
        <div class="info-box">
          <p style="font-size:7.5pt;color:#64748b;margin:0 0 10px;line-height:1.6;">For Cash Advances (CA), the requisitioner agrees to liquidate the CA, with relevant invoices, <strong>not later than one (1) month</strong> from the date of this voucher.</p>
          <span class="info-label">Printed Name</span>
          <span class="info-val">${escapeHtml(data.requesterName) || '—'}</span>
          <span class="info-label">Signature</span>
          ${sigHtml}
        </div>
      </div>
      <div>
        <div class="section-title">Bank Details for Payment</div>
        <div class="info-box">
          <span class="info-label">Account Name</span>
          <span class="info-val">${escapeHtml(data.accountName) || '—'}</span>
          <div style="display:grid;grid-template-columns:1fr 1.6fr;gap:10px;">
            <div><span class="info-label">BSB</span><span class="info-val">${escapeHtml(data.bsb) || '—'}</span></div>
            <div><span class="info-label">Account No.</span><span class="info-val">${escapeHtml(data.accountNo) || '—'}</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Approval — Notification Routing</div>
    <div class="appr-header">APPROVAL — NOTIFICATION ROUTING</div>
    <div class="appr-tier">Approval Tier: <span class="tier-badge">${escapeHtml(tierLbl)}</span></div>
    <div class="appr-grid">
      <table style="width:100%;border-collapse:separate;border-spacing:5px;">
        <tr>${approverCols}</tr>
      </table>
    </div>
    <div class="pilot-note">${escapeHtml(PILOT_SIGNATURE_DISCLAIMER)}</div>
  </div>

  <div class="section">
    <div class="limits-box">
      <h4>Approval Limits</h4>
      <div class="limit-row"><span class="limit-amt">≤ $500</span><span>1 Ministry Overseer</span></div>
      <div class="limit-row"><span class="limit-amt">&gt; $500 to $2,000</span><span>1 Ministry Overseer + 1 COS</span></div>
      <div class="limit-row"><span class="limit-amt">&gt; $2,000 to $5,000</span><span>2 COS + Finance Overseer</span></div>
      <div class="limit-row"><span class="limit-amt">&gt; $5,000</span><span>2 COS + Finance Overseer (+ Regional Director if Oceana)</span></div>
      <div class="limit-warn">⛔ No breaking of total amount for less approval.</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Ministry COS / Overseer Reference</div>
    <table class="min-table">
      <thead>${ministryTableRows}</thead>
    </table>
  </div>

</div>

<div class="footer">CCF Australia – Melbourne &nbsp;|&nbsp; Disbursement Voucher &nbsp;|&nbsp; PILOT/TEST — Confidential &nbsp;|&nbsp; Generated: ${new Date().toLocaleString('en-AU')}</div>

<script>
  window.onload = function() {
    setTimeout(function() { window.print(); }, 400);
  };
<\/script>
</body>
</html>`);
  w.document.close();
}

// ── PDF FILE (direct download via iframe print) ───────────────
function downloadPDFFile(data, lines, total, tierLbl, approvers, areaText, miniText, voucherNo, sigData) {
  const sigHtml = sigData
    ? `<img src="${sigData}" style="max-height:48px;max-width:100%;border:1px solid #e2e8f0;border-radius:5px;background:#f8fafc;padding:3px;display:block;" alt="Signature">`
    : '<div style="height:32px;border-bottom:1.5px solid #00A8B4;width:100%;"></div>';

  const lineRows = lines.map((l, i) => `
    <tr style="background:${i % 2 === 0 ? '#f8fafc' : 'white'}">
      <td style="padding:3px 6px;border-bottom:1px solid #e2e8f0;font-size:7.5pt;color:#94a3b8;width:20px;text-align:center;">${i+1}</td>
      <td style="padding:3px 6px;border-bottom:1px solid #e2e8f0;font-size:7.5pt;">${escapeHtml(l.desc || '')}</td>
      <td style="padding:3px 6px;border-bottom:1px solid #e2e8f0;font-size:7.5pt;text-align:right;font-family:monospace;">$ ${parseFloat(l.amt||0).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
    </tr>`).join('');

  const approverCols = approvers.map(a => `
    <td style="padding:5px 4px;border:1.5px solid ${a.required ? '#00A8B4' : '#e2e8f0'};border-radius:6px;vertical-align:top;background:${a.required ? '#e0f7f9' : '#f8fafc'};width:20%;opacity:${a.required ? '1' : '0.38'};">
      <div style="font-size:7pt;font-weight:700;color:#00919b;text-transform:uppercase;letter-spacing:0.8px;text-align:center;line-height:1.4;margin-bottom:3px;">${escapeHtml(a.title)}</div>
      ${a.required ? `
        <div style="font-size:6.5pt;color:#dc2626;text-align:center;margin-bottom:4px;font-weight:600;">● REQUIRED</div>
        ${a.name  ? `<div style="font-size:7.5pt;font-weight:600;color:#1a1f2e;text-align:center;margin-bottom:2px;">👤 ${escapeHtml(a.name)}</div>` : ''}
        ${a.email ? `<div style="font-size:6.5pt;color:#007d88;font-family:monospace;word-break:break-all;text-align:center;margin-bottom:5px;">${escapeHtml(a.email)}</div>` : ''}
        <div style="border-top:1px solid #b2e8ec;padding-top:4px;font-size:6pt;color:#92400e;">Signature not collected — pilot</div>
      ` : `<div style="font-size:7pt;color:#94a3b8;text-align:center;margin-top:5px;">Not required<br>for this tier</div>`}
    </td>`).join('');

  const htmlContent = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>CCF Voucher ${voucherNo}</title>
<style>
  @page{size:A4;margin:6mm 8mm;}
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  body{font-family:Arial,sans-serif;font-size:8pt;color:#1a1f2e;margin:0;padding:0;background:white;}
  .hdr{background:linear-gradient(135deg,#00A8B4,#007d88);color:white;padding:8px 14px;border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:space-between;}
  .hl{display:flex;align-items:center;gap:8px;}
  .lb{background:white;border-radius:6px;padding:3px 5px;}
  .hdr h1{margin:0;font-size:12pt;font-weight:700;}
  .hdr p{margin:1px 0 0;font-size:7pt;opacity:0.78;letter-spacing:1.2px;text-transform:uppercase;}
  .hm{text-align:right;}
  .ml{font-size:6.5pt;opacity:0.65;font-weight:600;letter-spacing:1px;text-transform:uppercase;display:block;}
  .mv{font-family:monospace;font-size:10pt;font-weight:700;display:block;}
  .fb{border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;overflow:hidden;}
  .sec{padding:5px 12px;border-bottom:1px solid #e2e8f0;}
  .st{font-size:6.5pt;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#00919b;margin-bottom:5px;display:flex;align-items:center;gap:6px;}
  .st::after{content:'';flex:1;height:1px;background:#e2e8f0;}
  .r3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;}
  .r2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
  .fx{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:4px;padding:4px 7px;}
  .fl{font-size:6.5pt;font-weight:700;color:#64748b;text-transform:uppercase;display:block;margin-bottom:1px;}
  .fv{font-size:8.5pt;color:#1a1f2e;font-weight:500;}
  .nt{background:#fffbeb;border:1px solid #fde68a;border-radius:4px;padding:4px 10px;font-size:7pt;color:#92400e;font-weight:600;}
  .it{width:100%;border-collapse:collapse;}
  .it thead th{background:#00A8B4;color:white;font-size:7pt;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;padding:4px 6px;text-align:left;}
  .it thead th:last-child{text-align:right;}
  .tb{display:flex;justify-content:space-between;align-items:center;background:#e0f7f9;border:1.5px solid #00A8B4;border-radius:4px;padding:5px 10px;margin-top:4px;}
  .tb span:first-child{font-size:8.5pt;font-weight:700;color:#007d88;}
  .tb span:last-child{font-family:monospace;font-size:10pt;font-weight:700;color:#007d88;}
  .ib{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:5px;padding:6px 10px;}
  .ib h3{font-size:6.5pt;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#00919b;margin:0 0 4px;padding-bottom:3px;border-bottom:1px solid #e2e8f0;}
  .il{font-size:6.5pt;font-weight:700;color:#64748b;text-transform:uppercase;display:block;margin-bottom:1px;}
  .iv{font-size:8pt;color:#1a1f2e;font-weight:500;margin-bottom:4px;display:block;}
  .ah{background:linear-gradient(135deg,#00A8B4,#007d88);color:white;padding:5px 12px;font-weight:700;font-size:7.5pt;border-radius:5px 5px 0 0;}
  .at{background:#e0f7f9;border:1px solid #00A8B4;padding:4px 10px;border-radius:0 0 5px 5px;margin-bottom:5px;font-size:7.5pt;color:#007d88;font-weight:600;}
  .tb2{background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-weight:700;font-size:7pt;padding:2px 6px;border-radius:20px;margin-left:5px;}
  .lm{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:5px;padding:5px 10px;}
  .lm h4{font-size:6.5pt;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#00919b;margin:0 0 4px;}
  .lr{display:flex;align-items:baseline;gap:6px;margin-bottom:2px;font-size:7pt;}
  .la{font-family:monospace;font-weight:700;color:#007d88;min-width:100px;font-size:7pt;}
  .lw{color:#dc2626;font-weight:700;font-size:7pt;margin-top:4px;}
  .mt{width:100%;border-collapse:collapse;border-radius:5px;overflow:hidden;border:1.5px solid #e2e8f0;}
  .mt th,.mt td{border-right:1px solid rgba(255,255,255,0.2);padding:4px 5px;font-size:6.5pt;text-align:center;}
  .mt td{border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;color:#1a1f2e;}
  .ft{margin-top:5px;border-top:1px solid #00A8B4;padding-top:4px;text-align:center;font-size:6.5pt;color:#94a3b8;}
  .pn{background:#fffbeb;border:1px solid #fde68a;color:#92400e;padding:4px 8px;font-size:6pt;margin-top:4px;border-radius:4px;}
</style></head><body>
<div class="hdr">
  <div class="hl">
    <div class="lb">
      <svg width="56" height="32" viewBox="0 0 110 60" xmlns="http://www.w3.org/2000/svg">
        <circle cx="30" cy="30" r="26" fill="none" stroke="#00A8B4" stroke-width="2.5"/>
        <text x="30" y="36" font-family="Arial,sans-serif" font-weight="900" font-size="16" fill="#00A8B4" text-anchor="middle" letter-spacing="1">ccf</text>
        <text x="62" y="19" font-family="Arial,sans-serif" font-weight="700" font-size="7.5" fill="#00A8B4" letter-spacing="0.5">CHRIST'S</text>
        <text x="62" y="29" font-family="Arial,sans-serif" font-weight="700" font-size="7.5" fill="#00A8B4" letter-spacing="0.5">COMMISSION</text>
        <text x="62" y="39" font-family="Arial,sans-serif" font-weight="700" font-size="7.5" fill="#00A8B4" letter-spacing="0.5">FELLOWSHIP</text>
        <text x="62" y="49" font-family="Arial,sans-serif" font-weight="700" font-size="7.5" fill="#00A8B4" letter-spacing="0.5">AUSTRALIA</text>
      </svg>
    </div>
    <div><h1>CCF Australia</h1><p>Melbourne · Disbursement Voucher — PILOT/TEST</p></div>
  </div>
  <div class="hm">
    <span class="ml">Voucher No.</span><span class="mv">${escapeHtml(voucherNo)}</span>
    <span class="ml" style="margin-top:3px;">Date</span><span class="mv">${escapeHtml(data.voucherDate)||'—'}</span>
  </div>
</div>
<div class="fb">
  <div class="sec">
    <div class="st">Request Details</div>
    <div class="r3">
      <div class="fx"><span class="fl">Request Type</span><span class="fv">${escapeHtml(data.requestType)||'—'}</span></div>
      <div class="fx"><span class="fl">Ministry Type</span><span class="fv">${escapeHtml(miniText)}</span></div>
      <div class="fx"><span class="fl">Area</span><span class="fv">${escapeHtml(areaText)}</span></div>
    </div>
  </div>
  <div class="sec" style="padding-top:0;padding-bottom:5px;border-bottom:none;">
    <div class="nt">⚠ NOTE: One ministry per voucher only. No breaking of total amount for less approval.</div>
  </div>
  <div class="sec">
    <div class="st">Description / Receipts Attached</div>
    <table class="it"><thead><tr><th style="width:20px;">#</th><th>Description</th><th style="text-align:right">Amount (AUD)</th></tr></thead>
    <tbody>${lineRows}</tbody></table>
    <div class="tb"><span>TOTAL</span><span>$ ${total.toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>
  </div>
  <div class="sec">
    <div class="r2">
      <div>
        <div class="st">Requisitioned By</div>
        <div class="ib">
          <p style="font-size:6.5pt;color:#64748b;margin:0 0 5px;line-height:1.5;">For Cash Advances (CA), the requisitioner agrees to liquidate the CA, with relevant invoices, <strong>not later than one (1) month</strong> from date of this voucher.</p>
          <span class="il">Printed Name</span><span class="iv">${escapeHtml(data.requesterName)||'—'}</span>
          <span class="il">Signature</span>${sigHtml}
        </div>
      </div>
      <div>
        <div class="st">Bank Details for Payment</div>
        <div class="ib">
          <span class="il">Account Name</span><span class="iv">${escapeHtml(data.accountName)||'—'}</span>
          <div style="display:grid;grid-template-columns:1fr 1.6fr;gap:8px;">
            <div><span class="il">BSB</span><span class="iv">${escapeHtml(data.bsb)||'—'}</span></div>
            <div><span class="il">Account No.</span><span class="iv">${escapeHtml(data.accountNo)||'—'}</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="sec">
    <div class="st">Approval — Notification Routing</div>
    <div class="ah">APPROVAL — NOTIFICATION ROUTING</div>
    <div class="at">Approval Tier: <span class="tb2">${escapeHtml(tierLbl)}</span></div>
    <table style="width:100%;border-collapse:separate;border-spacing:4px;margin-bottom:6px;"><tr>${approverCols}</tr></table>
    <div class="pn">${escapeHtml(PILOT_SIGNATURE_DISCLAIMER)}</div>
  </div>
  <div class="sec">
    <div class="lm">
      <h4>Approval Limits</h4>
      <div class="lr"><span class="la">≤ $500</span><span>1 Ministry Overseer</span></div>
      <div class="lr"><span class="la">&gt; $500–$2,000</span><span>1 Ministry Overseer + 1 COS</span></div>
      <div class="lr"><span class="la">&gt; $2,000–$5,000</span><span>2 COS + Finance Overseer</span></div>
      <div class="lr"><span class="la">&gt; $5,000</span><span>2 COS + Finance Overseer (+ Regional Director if Oceana)</span></div>
      <div class="lw">⛔ No breaking of total amount for less approval.</div>
    </div>
  </div>
  <div class="sec">
    <div class="st">Ministry COS / Overseer Reference</div>
    <table class="mt">
      <thead>
        <tr>
          <th style="background:#00A8B4;color:white;font-weight:700;text-align:left;">Ministry</th>
          <th style="background:#e0f7f9;color:#00919b;font-weight:700;">ADMIN / EXALT</th>
          <th style="background:white;color:#00919b;font-weight:700;">FINANCE / NXTGEN</th>
          <th style="background:#e0f7f9;color:#00919b;font-weight:700;">B1G / ELEVATE / HOST</th>
          <th style="background:white;color:#00919b;font-weight:700;">COMMS / MEDIA</th>
          <th style="background:#e0f7f9;color:#00919b;font-weight:700;">OCEANA (&gt;$5k)</th>
        </tr>
        <tr><td style="background:#00919b;color:white;font-weight:700;text-align:left;">COS/Overseer</td><td colspan="5" style="background:#00919b;"></td></tr>
      </thead>
      <tbody>
        <tr>
          <td style="background:#f8fafc;font-weight:700;color:#00919b;text-align:left;">Name</td>
          <td style="background:#f8fafc;">Ross Callado</td>
          <td style="background:white;">Joel Jerez</td>
          <td style="background:#f8fafc;">Vamie Pinlac / Robert Cruz / Joshua Mangalong</td>
          <td style="background:white;">Dexter Santiago / Moriz Manlangit</td>
          <td style="background:#f8fafc;">Ptr. Ryan Escobar</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
<div class="ft">CCF Australia – Melbourne &nbsp;|&nbsp; Disbursement Voucher &nbsp;|&nbsp; PILOT/TEST — Confidential &nbsp;|&nbsp; ${new Date().toLocaleString('en-AU')}</div>
<script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script>
</body></html>`;

  const blob   = new Blob([htmlContent], { type: 'text/html' });
  const url    = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;';
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = function() {
    setTimeout(function() {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch(e) {
        window.open(url, '_blank');
      }
      setTimeout(function() {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 5000);
    }, 400);
  };
  showToast('📥 PDF ready — choose "Save as PDF" in the print dialog', '#00A8B4');
}

function downloadHTML(data, lines, total, tierLbl, approvers, areaText, miniText, voucherNo, sigData) {
  const approverBoxesHtml = approvers.map(a => `
    <div class="approver-box" style="opacity:${a.required ? '1' : '0.4'};">
      <h4>${escapeHtml(a.title)}</h4>
      ${a.required ? `
        ${a.name ? `<p style="font-weight:600;font-size:11px;color:#1a1f2e;margin:4px 0 2px;">👤 ${escapeHtml(a.name)}</p>` : ''}
        ${a.email ? `<p style="font-size:10px;color:#007d88;font-family:monospace;word-break:break-all;margin:0 0 6px;">${escapeHtml(a.email)}</p>` : ''}
        <div style="border-top:1px solid #b2e8ec;margin:6px 0;padding-top:6px;font-size:9px;color:#92400e;">Signature not collected — pilot</div>` :
        '<p style="font-size:10px;color:#94a3b8;margin:6px 0;">Not required for this tier</p>'
      }
    </div>`).join('');

  const sigHtml = sigData ? `<img src="${sigData}" style="height:50px;border:1px solid #e2e8f0;border-radius:6px;padding:4px;" alt="Signature">` : '<div style="height:50px;border:1px dashed #e2e8f0;border-radius:6px;"></div>';

  const lineRows = lines.map((l,i) => `<tr style="background:${i%2===0?'#f8fafc':'white'}">
    <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;">${i+1}. ${escapeHtml(l.desc||'—')}</td>
    <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace;">$ ${parseFloat(l.amt||0).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
  </tr>`).join('');

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>CCF Disbursement Voucher — ${voucherNo}</title>
<style>
  body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#1a1f2e;font-size:13px;background:white;}
  .header{background:linear-gradient(135deg,#00A8B4,#007d88);color:white;padding:20px 28px;border-radius:10px 10px 0 0;display:flex;align-items:center;justify-content:space-between;}
  .header h1{margin:0;font-size:20px;} .header p{margin:4px 0 0;font-size:11px;opacity:0.8;letter-spacing:1px;text-transform:uppercase;}
  .meta{font-size:12px;text-align:right;} .meta span{display:block;opacity:0.8;font-size:10px;} .meta strong{font-size:14px;font-family:monospace;}
  .body{border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;padding:20px 28px;}
  .row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;}
  .field{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;}
  .field label{font-size:10px;font-weight:bold;color:#00919b;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:3px;}
  .notice{background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:8px 12px;font-size:11px;color:#92400e;font-weight:500;margin-bottom:16px;}
  table{width:100%;border-collapse:collapse;border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:8px;}
  thead th{background:#00A8B4;color:white;padding:9px 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;}
  thead th:last-child{text-align:right;}
  .total-row{background:#e0f7f9;border:1.5px solid #00A8B4;border-radius:6px;padding:10px 14px;display:flex;justify-content:space-between;font-weight:700;color:#007d88;margin-bottom:16px;}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;}
  .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;}
  .box h3{font-size:10px;font-weight:bold;color:#00919b;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;}
  .approval-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px;}
  .approver-box{background:#e0f7f9;border:1.5px solid #00A8B4;border-radius:6px;padding:10px 8px;text-align:center;}
  .approver-box h4{font-size:9px;font-weight:bold;color:#00919b;text-transform:uppercase;margin:0 0 6px;letter-spacing:0.8px;}
  .limits{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px 16px;font-size:11px;}
  .limits h4{font-size:10px;font-weight:bold;color:#00919b;text-transform:uppercase;margin:0 0 8px;}
  .tier-badge{background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-weight:600;font-size:11px;padding:3px 10px;border-radius:20px;display:inline-block;}
  .footer{margin-top:16px;border-top:1px solid #e2e8f0;padding-top:8px;text-align:center;font-size:10px;color:#94a3b8;}
  .pilot-note{background:#fffbeb;border:1px solid #fde68a;color:#92400e;padding:10px 14px;border-radius:6px;font-size:11px;margin-bottom:16px;}
  @media print{body{padding:10px;}}
</style></head><body>
<div class="header">
  <div><h1>CCF Australia</h1><p>Melbourne · Disbursement Voucher — PILOT/TEST</p></div>
  <div class="meta"><span>VOUCHER NO.</span><strong>${escapeHtml(voucherNo)}</strong><span style="margin-top:6px;">DATE</span><strong>${escapeHtml(data.voucherDate)||'—'}</strong></div>
</div>
<div class="body">
  <div class="row3">
    <div class="field"><label>Request Type</label><span>${escapeHtml(data.requestType)||'—'}</span></div>
    <div class="field"><label>Ministry Type</label><span>${escapeHtml(miniText)}</span></div>
    <div class="field"><label>Area</label><span>${escapeHtml(areaText)}</span></div>
  </div>
  <div class="notice">⚠ NOTE: One ministry per voucher only. No breaking of total amount for less approval.</div>
  <table><thead><tr><th style="text-align:left">Description / Receipts Attached</th><th>Amount (AUD)</th></tr></thead><tbody>${lineRows}</tbody></table>
  <div class="total-row"><span>TOTAL</span><span>$ ${total.toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>
  <div class="two-col">
    <div class="box"><h3>Requisitioned By</h3>
      <p style="font-size:11px;color:#64748b;margin:0 0 10px;">For Cash Advances (CA), the requisitioner agrees to liquidate the CA with invoices, not later than one (1) month from the date of this voucher.</p>
      <p style="font-weight:600;margin:0 0 8px;">${escapeHtml(data.requesterName)||'—'}</p>${sigHtml}
    </div>
    <div class="box"><h3>Bank Details for Payment</h3>
      <p style="margin:0 0 6px;"><strong>Account Name:</strong> ${escapeHtml(data.accountName)||'—'}</p>
      <p style="margin:0 0 6px;"><strong>BSB:</strong> ${escapeHtml(data.bsb)||'—'}</p>
      <p style="margin:0;"><strong>Account No.:</strong> ${escapeHtml(data.accountNo)||'—'}</p>
    </div>
  </div>
  <div style="background:#00A8B4;color:white;padding:8px 14px;border-radius:8px 8px 0 0;font-weight:700;font-size:12px;">APPROVAL — NOTIFICATION ROUTING</div>
  <div style="background:#e0f7f9;border:1px solid #00A8B4;padding:10px 14px;border-radius:0 0 8px 8px;margin-bottom:12px;">
    <span style="font-size:11px;color:#007d88;font-weight:600;">Approval Tier: </span><span class="tier-badge">${escapeHtml(tierLbl)}</span>
  </div>
  <div class="approval-grid">${approverBoxesHtml}</div>
  <div class="pilot-note">${escapeHtml(PILOT_SIGNATURE_DISCLAIMER)}</div>
  <div class="limits">
    <h4>Approval Limits</h4>
    <div style="display:flex;gap:10px;margin-bottom:4px;"><span style="font-family:monospace;font-weight:600;color:#007d88;min-width:130px;">≤ $500</span><span>1 Ministry Overseer</span></div>
    <div style="display:flex;gap:10px;margin-bottom:4px;"><span style="font-family:monospace;font-weight:600;color:#007d88;min-width:130px;">&gt; $500 to $2,000</span><span>1 Ministry Overseer + 1 COS</span></div>
    <div style="display:flex;gap:10px;margin-bottom:4px;"><span style="font-family:monospace;font-weight:600;color:#007d88;min-width:130px;">&gt; $2,000 to $5,000</span><span>2 COS + Finance Overseer</span></div>
    <div style="display:flex;gap:10px;"><span style="font-family:monospace;font-weight:600;color:#007d88;min-width:130px;">&gt; $5,000</span><span>2 COS + Finance Overseer (+ Regional Director if Oceana)</span></div>
    <div style="color:#dc2626;font-weight:600;margin-top:8px;font-size:11px;">⛔ No breaking of total amount for less approval.</div>
  </div>
  <div class="footer">CCF Australia – Melbourne | Disbursement Voucher | PILOT/TEST — Confidential | Generated: ${new Date().toLocaleString('en-AU')}</div>
</div></body></html>`;

  const blob = new Blob([html], {type: 'text/html'});
  triggerDownload(blob, `CCF_Voucher_${voucherNo}_${data.voucherDate||'draft'}.html`);
  showToast('🌐 HTML downloaded!', '#00A8B4');
}

// ── TRIGGER ───────────────────────────────────────────────────
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

init();
loadSavedForm();
