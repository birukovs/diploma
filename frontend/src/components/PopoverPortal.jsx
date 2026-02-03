import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const PopoverPortal = ({
  open,
  anchorRef,
  popoverRef,
  children,
  className = "",
  zIndex = 3000,
  offset = 8,
  padding = 8,
  placement = "top", // "top" | "left" | "right" | "top-start" | "top-end"
  deps = [],
}) => {
  const internalRef = useRef(null);
  const resolvedRef = popoverRef || internalRef;
  const [position, setPosition] = useState({ top: 0, left: 0, ready: false });

  useLayoutEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const anchor = anchorRef?.current;
      const popover = resolvedRef.current;
      if (!anchor || !popover) return;

      const anchorRect = anchor.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();

      let top = 0;
      let left = 0;

      // Calculate position based on placement
      if (placement === "left" || placement === "left-start") {
        // Position to the left of anchor
        left = anchorRect.left - popoverRect.width - offset;
        top = placement === "left-start"
          ? anchorRect.top
          : anchorRect.top + anchorRect.height / 2 - popoverRect.height / 2;
        // If goes off left edge, flip to right
        if (left < padding) {
          left = anchorRect.right + offset;
        }
      } else if (placement === "right" || placement === "right-start") {
        // Position to the right of anchor
        left = anchorRect.right + offset;
        top = placement === "right-start"
          ? anchorRect.top
          : anchorRect.top + anchorRect.height / 2 - popoverRect.height / 2;
        // If goes off right edge, flip to left
        if (left + popoverRect.width > window.innerWidth - padding) {
          left = anchorRect.left - popoverRect.width - offset;
        }
      } else if (placement === "top-start") {
        top = anchorRect.top - popoverRect.height - offset;
        left = anchorRect.left;
        if (top < padding) {
          top = anchorRect.bottom + offset;
        }
      } else if (placement === "top-end") {
        top = anchorRect.top - popoverRect.height - offset;
        left = anchorRect.right - popoverRect.width;
        if (top < padding) {
          top = anchorRect.bottom + offset;
        }
      } else {
        // Default: top center
        top = anchorRect.top - popoverRect.height - offset;
        left = anchorRect.left + anchorRect.width / 2 - popoverRect.width / 2;
        if (top < padding) {
          top = anchorRect.bottom + offset;
        }
      }

      // Clamp horizontal position to screen
      const maxLeft = window.innerWidth - popoverRect.width - padding;
      left = clamp(left, padding, Math.max(padding, maxLeft));

      // Clamp vertical position to screen
      const maxTop = window.innerHeight - popoverRect.height - padding;
      top = clamp(top, padding, Math.max(padding, maxTop));

      setPosition({ top, left, ready: true });
    };

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, anchorRef, resolvedRef, offset, padding, placement, deps]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={resolvedRef}
      className={className}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        zIndex,
        opacity: position.ready ? 1 : 0,
      }}
    >
      {children}
    </div>,
    document.body
  );
};

export default PopoverPortal;
