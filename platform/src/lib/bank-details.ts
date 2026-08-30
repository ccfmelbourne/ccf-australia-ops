// Pure and directly testable -- no network/DB calls. Mirrors the
// assertValidReceiptFile/buildReceiptStorageKey split in receipt-storage.ts.
// BSB/account-number format is validated loosely (digit-count only, not a
// per-bank checksum) since format conventions vary by institution and
// over-validating risks rejecting real accounts.

export function normalizeBsb(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 6) {
    throw new Error("BSB must be 6 digits (e.g. 123-456).");
  }
  return digits;
}

export function formatBsb(bsb: string): string {
  return `${bsb.slice(0, 3)}-${bsb.slice(3)}`;
}

export function assertValidAccountNumber(raw: string): void {
  if (!/^\d{4,10}$/.test(raw)) {
    throw new Error("Account number must be 4-10 digits.");
  }
}
