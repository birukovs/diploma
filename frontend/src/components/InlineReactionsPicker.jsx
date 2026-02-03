import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultReactionOptions,
  ReactionSelector as DefaultReactionSelector,
  useComponentContext,
  useMessageContext,
  useTranslationContext,
} from "stream-chat-react";
import QuickReactionsBar from "./QuickReactionsBar";
import PopoverPortal from "./PopoverPortal";

const InlineReactionsPicker = ({ ReactionIcon, onOpenChange }) => {
  const { t } = useTranslationContext("InlineReactionsPicker");
  const { message, handleReaction, isMyMessage } = useMessageContext(
    "InlineReactionsPicker"
  );
  const isMine = isMyMessage?.() ?? false;
  const {
    ReactionSelector = DefaultReactionSelector,
    reactionOptions: contextReactionOptions,
  } = useComponentContext("MessageOptions");
  const [open, setOpen] = useState(false);
  const [showFullPicker, setShowFullPicker] = useState(false);
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);

  const ReactionIconComponent = ReactionIcon;
  const reactionOptions = contextReactionOptions || defaultReactionOptions;
  const quickReactionOptions = reactionOptions.slice(0, 7);
  const close = useCallback(() => {
    setShowFullPicker(false);
    setOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      if (prev) {
        setShowFullPicker(false);
      }
      return !prev;
    });
  }, []);

  const handleSelectReaction = useCallback(
    (reactionType, event) => {
      handleReaction?.(reactionType, event);
      close();
    },
    [handleReaction, close]
  );

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event) => {
      const target = event.target;
      if (popoverRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      close();
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  if (!message?.id) return null;

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-label={t("aria/Open Reaction Selector")}
        className="str-chat__message-reactions-button message-circle-action-button message-circle-action-button--no-border"
        data-testid="message-reaction-action"
        onClick={toggle}
        ref={buttonRef}
      >
        <ReactionIconComponent className="str-chat__message-action-icon" />
      </button>
      <PopoverPortal
        open={open}
        anchorRef={buttonRef}
        popoverRef={popoverRef}
        className="inline-reactions-popover"
        zIndex={3000}
        placement={isMine ? "top-end" : "top-start"}
        deps={[showFullPicker]}
      >
        <div
          data-testid="inline-reactions-popover"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px",
            borderRadius: "12px",
            background: "#0f1116",
            border: "1px solid rgba(226, 26, 26, 0.25)",
            boxShadow: "0 15px 40px rgba(0, 0, 0, 0.45)",
            maxWidth: "min(360px, 90vw)",
            overflow: "visible",
          }}
        >
          <QuickReactionsBar
            options={quickReactionOptions}
            onSelect={handleSelectReaction}
            onMore={() => setShowFullPicker((prev) => !prev)}
          />
          {showFullPicker && (
            <div className="inline-reactions-popover__full">
              <ReactionSelector
                handleReaction={handleSelectReaction}
                detailedView={false}
              />
            </div>
          )}
        </div>
      </PopoverPortal>
    </>
  );
};

export default InlineReactionsPicker;
