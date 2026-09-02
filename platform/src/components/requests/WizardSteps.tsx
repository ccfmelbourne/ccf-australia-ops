export type WizardStep = 1 | 2 | 3 | 4;

const WIZARD_STEP_LABELS: Record<WizardStep, string> = {
  1: "Details",
  2: "Expenses & Receipts",
  3: "Payment",
  4: "Review",
};

// Step pills jump back freely but never ahead of furthestStep -- reaching
// a step earns it, it's not a free-form tab bar. Kept in its own file
// (rather than defined inline in RequestDrawer.tsx, which also imports
// the create/edit Server Actions) so it -- and its "use client"-free
// import graph -- can be storied in Storybook without pulling in Prisma
// and the rest of that server-side dependency graph into the bundle.
export function WizardSteps({
  currentStep,
  furthestStep,
  onJump,
}: {
  currentStep: WizardStep;
  furthestStep: WizardStep;
  onJump: (step: WizardStep) => void;
}) {
  const steps: WizardStep[] = [1, 2, 3, 4];
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-1">
          <button
            type="button"
            disabled={step > furthestStep}
            onClick={() => onJump(step)}
            className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 font-semibold disabled:cursor-not-allowed ${
              step === currentStep
                ? "bg-teal-600 text-white"
                : step < furthestStep
                  ? "text-teal-700 hover:bg-teal-50"
                  : "text-slate-500"
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                step === currentStep
                  ? "bg-white text-teal-600"
                  : step <= furthestStep
                    ? "bg-teal-100 text-teal-700"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              {step}
            </span>
            {WIZARD_STEP_LABELS[step]}
          </button>
          {i < steps.length - 1 && <span className="h-px w-3 shrink-0 bg-slate-300" />}
        </div>
      ))}
    </div>
  );
}
