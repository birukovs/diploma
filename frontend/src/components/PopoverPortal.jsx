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
  placement = "top", // значения: "top" | "left" | "right" | "top-start" | "top-end"
  deps = [],
}) => {
  const internalRef = useRef(null);
  const resolvedRef = popoverRef || internalRef;
  const [position, setPosition] = useState({ top: 0, left: 0, ready: false });
  const portalTarget =
    typeof document === "undefined" ? null : document.body;

  useLayoutEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const anchor = anchorRef?.current;
      const popover = resolvedRef.current;
      if (!anchor || !popover) return;

      const anchorRect = anchor.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      const containerRect = { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
      const anchorLeft = anchorRect.left - containerRect.left;
      const anchorRight = anchorRect.right - containerRect.left;
      const anchorTop = anchorRect.top - containerRect.top;
      const anchorBottom = anchorRect.bottom - containerRect.top;

      let top = 0;
      let left = 0;

      // Вычисляем позицию по placement
      if (placement === "left" || placement === "left-start") {
        // Позиция слева от якоря
        left = anchorLeft - popoverRect.width - offset;
        top = placement === "left-start"
          ? anchorTop
          : anchorTop + anchorRect.height / 2 - popoverRect.height / 2;
        // Если выходит за левый край, переносим вправо
        if (left + containerRect.left < padding) {
          left = anchorRight + offset;
        }
      } else if (placement === "right" || placement === "right-start") {
        // Позиция справа от якоря
        left = anchorRight + offset;
        top = placement === "right-start"
          ? anchorTop
          : anchorTop + anchorRect.height / 2 - popoverRect.height / 2;
        // Если выходит за правый край, переносим влево
        if (left + containerRect.left + popoverRect.width > window.innerWidth - padding) {
          left = anchorLeft - popoverRect.width - offset;
        }
      } else if (placement === "top-start") {
        top = anchorTop - popoverRect.height - offset;
        left = anchorLeft;
        if (top + containerRect.top < padding) {
          top = anchorBottom + offset;
        }
      } else if (placement === "top-end") {
        top = anchorTop - popoverRect.height - offset;
        left = anchorRight - popoverRect.width;
        if (top + containerRect.top < padding) {
          top = anchorBottom + offset;
        }
      } else {
        // По умолчанию: сверху по центру
        top = anchorTop - popoverRect.height - offset;
        left = anchorLeft + anchorRect.width / 2 - popoverRect.width / 2;
        if (top + containerRect.top < padding) {
          top = anchorBottom + offset;
        }
      }

      // Ограничиваем по горизонтали
      const minLeft = padding - containerRect.left;
      const maxLeft = window.innerWidth - popoverRect.width - padding - containerRect.left;
      left = clamp(left, minLeft, Math.max(minLeft, maxLeft));

      // Ограничиваем по вертикали
      const minTop = padding - containerRect.top;
      const maxTop = window.innerHeight - popoverRect.height - padding - containerRect.top;
      top = clamp(top, minTop, Math.max(minTop, maxTop));

      setPosition((prev) => {
        const same =
          prev.ready &&
          Math.abs(prev.top - top) < 0.5 &&
          Math.abs(prev.left - left) < 0.5;
        if (same) return prev;
        return { top, left, ready: true };
      });
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

  const target = portalTarget || document.body;

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
    target
  );
};

export default PopoverPortal;
