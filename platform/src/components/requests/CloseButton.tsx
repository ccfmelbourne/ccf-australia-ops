import { Button } from "@/components/Button";

// A second, explicit way to close a drawer panel beyond its header X --
// confirmed with the decision-maker after removing backdrop-click-to-close
// (to prevent accidental dismissal) left the X as the only way out, and a
// header isn't sticky, so it scrolls out of view on a long/scrollable
// panel. Placed at the bottom of a panel's content (or alongside each
// wizard step's own action row, for RequestDrawer) so it's reachable from
// wherever the requester's actually scrolled to. Styled as the secondary,
// bordered variant so it doesn't visually compete with a primary action.
export function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <Button variant="secondary" onClick={onClose}>
      Close
    </Button>
  );
}
