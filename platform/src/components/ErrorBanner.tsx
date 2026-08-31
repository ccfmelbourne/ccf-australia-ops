// Shared inline error style, used anywhere a form/action can fail --
// matches the visual language of RequestDrawer.tsx's amber "changes
// requested"/"rejected" banner, just in red for an actual error. Always
// inline, never a toast -- several of this app's forms render inside a
// native <dialog>, where a toast would render behind the dialog's top
// layer and be invisible (see the memory on this).
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
      {message}
    </div>
  );
}
