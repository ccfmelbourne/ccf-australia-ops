import { Button } from "@/components/Button";

// A second, explicit way to close a drawer panel beyond its header X --
// after removing backdrop-click-to-close, the X was the only way out, and
// a non-sticky header scrolls out of view on a long panel. Placed at the
// bottom of a panel's content so it's reachable from wherever scrolled to.
export function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <Button variant="secondary" onClick={onClose}>
      Close
    </Button>
  );
}
