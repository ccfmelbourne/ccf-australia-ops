// Shared between finance-data.ts and request-data.ts so both display money
// the same way instead of duplicating the formatting rule.
export function formatAmount(amount: { toString(): string }): string {
  return Number(amount.toString()).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
