import { Alert } from "@/components/Alert";

// Shared inline error style, used anywhere a form/action can fail --
// matches the visual language of RequestDrawer.tsx's amber "changes
// requested"/"rejected" banner, just in red for an actual error. Always
// inline, never a toast -- several of this app's forms render inside a
// native <dialog>, where a toast would render behind the dialog's top
// layer and be invisible (see the memory on this).
export function ErrorBanner({ message }: { message: string }) {
  return <Alert tone="danger">{message}</Alert>;
}
