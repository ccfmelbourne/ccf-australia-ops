import { CreateRequestForm } from "./CreateRequestForm";

export default function NewRequestPage() {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-bold text-slate-900">New reimbursement request</h2>
      <CreateRequestForm />
    </div>
  );
}
