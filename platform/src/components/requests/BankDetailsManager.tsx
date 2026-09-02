"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBankDetailsAction } from "@/app/requests/actions";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Input } from "@/components/Input";
import { SectionHeading } from "@/components/SectionHeading";
import type { DraftBankDetailsView } from "@/lib/request-data";

export function BankDetailsManager({
  requestId,
  bankDetails,
}: {
  requestId: string;
  bankDetails: DraftBankDetailsView | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [accountName, setAccountName] = useState(bankDetails?.accountName ?? "");
  const [bsb, setBsb] = useState(bankDetails?.bsb ?? "");
  const [accountNumber, setAccountNumber] = useState(bankDetails?.accountNumber ?? "");
  // Never pre-filled, even when editing existing details -- the requester
  // must retype it every time as the anti-fat-finger check.
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("accountName", accountName);
    formData.set("bsb", bsb);
    formData.set("accountNumber", accountNumber);
    formData.set("confirmAccountNumber", confirmAccountNumber);
    startTransition(async () => {
      const result = await saveBankDetailsAction(requestId, formData);
      if (result.ok) {
        setConfirmAccountNumber("");
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <section>
      <SectionHeading>Bank details for payment</SectionHeading>
      <form
        onSubmit={handleSave}
        className="flex flex-col gap-3 rounded-md border border-slate-200 p-4"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="accountName" className="text-sm font-medium text-slate-700">
            Account name
          </label>
          <Input
            id="accountName"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="bsb" className="text-sm font-medium text-slate-700">
            BSB
          </label>
          <Input
            id="bsb"
            value={bsb}
            onChange={(e) => setBsb(e.target.value)}
            placeholder="123-456"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="accountNumber" className="text-sm font-medium text-slate-700">
            Account number
          </label>
          <Input
            id="accountNumber"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="confirmAccountNumber" className="text-sm font-medium text-slate-700">
            Confirm account number
          </label>
          <Input
            id="confirmAccountNumber"
            value={confirmAccountNumber}
            onChange={(e) => setConfirmAccountNumber(e.target.value)}
            required
          />
        </div>
        {error && <ErrorBanner message={error} />}
        <Button type="submit" disabled={isPending} className="self-start">
          {isPending ? "Saving…" : bankDetails ? "Update bank details" : "Save bank details"}
        </Button>
      </form>
    </section>
  );
}
