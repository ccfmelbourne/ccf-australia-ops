// Shared money-formatting rule so every display of an amount is consistent.
export function formatAmount(amount: { toString(): string }): string {
  return Number(amount.toString()).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
