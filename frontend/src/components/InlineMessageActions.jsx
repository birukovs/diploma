import { useCallback, useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pin, PinOff, Reply, Edit, Trash2, Flag } from "lucide-react";
import {
  MessageActionsWrapper,
  isUserMuted,
  shouldRenderMessageActions,
  useChatContext,
  useComponentContext,
  useMessageContext,
  useTranslationContext,
  useMessageComposer,
} from "stream-chat-react";
import { useInlineComposer } from "./InlineComposerContext";
import PopoverPortal from "./PopoverPortal";

// Check if message is a poll (cannot be edited)
const isPollMessage = (message) => {
  if (!message) return false;
  // Check for fallback poll
  if (message.custom_type === "poll" && message.poll_data) return true;
  // Check for Stream SDK poll
  if (message.poll) return true;
  return false;
};

// Custom MessageActionsBox with Pin/Unpin and Reply support
const CustomMessageActionsBox = ({
  getMessageActions,
  handleDelete,
  handleEdit,
  handleFlag,
  handlePin: _handlePin,
  handleReply,
  mine,
  open,
}) => {
  const { message } = useMessageContext("CustomMessageActionsBox");
  const { t } = useTranslationContext("CustomMessageActionsBox");
  const { channel, client } = useChatContext("CustomMessageActionsBox");

  if (!open || !message) return null;

  const messageActions = getMessageActions();
  const isPinned = message.pinned || Boolean(message.pinned_at);
  const isPoll = isPollMessage(message);

  const handlePinClick = async (event) => {
    event?.preventDefault?.();
    if (!channel || !message) return;

    try {
      const canPin = typeof channel.pinMessage === "function";
      const canUnpin = typeof channel.unpinMessage === "function";

      if (canPin && canUnpin) {
        if (isPinned) {
          await channel.unpinMessage(message);
        } else {
          await channel.pinMessage(message);
        }
      } else if (typeof channel.partialUpdateMessage === "function") {
        await channel.partialUpdateMessage(message.id, {
          set: { pinned: !isPinned },
        });
      } else if (client && typeof client.partialUpdateMessage === "function") {
        await client.partialUpdateMessage(message.id, {
          set: { pinned: !isPinned },
        });
      }
    } catch (error) {
      console.error("Pin error:", error);
    }
  };

  return (
    <div className="str-chat__message-actions-box" data-ui="pin-action-added-v1">
      <ul className="str-chat__message-actions-list">
        {messageActions.includes("reply") && (
          <li>
            <button
              className="str-chat__message-actions-list-item"
              onClick={handleReply}
            >
              <Reply size={16} />
              <span>{t("Reply")}</span>
            </button>
          </li>
        )}

        {messageActions.includes("edit") && mine && !isPoll && (
          <li>
            <button
              className="str-chat__message-actions-list-item"
              onClick={handleEdit}
            >
              <Edit size={16} />
              <span>{t("Edit Message")}</span>
            </button>
          </li>
        )}

        {messageActions.includes("pin") && (
          <li>
            <button
              className="str-chat__message-actions-list-item"
              onClick={handlePinClick}
            >
              {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
              <span>{isPinned ? t("Unpin") : t("Pin")}</span>
            </button>
          </li>
        )}

        {messageActions.includes("flag") && !mine && (
          <li>
            <button
              className="str-chat__message-actions-list-item"
              onClick={handleFlag}
            >
              <Flag size={16} />
              <span>{t("Flag")}</span>
            </button>
          </li>
        )}

        {messageActions.includes("delete") && (
          <li>
            <button
              className="str-chat__message-actions-list-item str-chat__message-actions-list-item--delete"
              onClick={handleDelete}
            >
              <Trash2 size={16} />
              <span>{t("Delete")}</span>
            </button>
          </li>
        )}
      </ul>
    </div>
  );
};

const InlineMessageActions = (props) => {
  const {
    ActionsIcon = MoreHorizontal,
    customWrapperClass = "",
    getMessageActions: propGetMessageActions,
    handleDelete: propHandleDelete,
    handleFlag: propHandleFlag,
    handleMarkUnread: propHandleMarkUnread,
    handleMute: propHandleMute,
    handlePin: propHandlePin,
    inline,
    message: propMessage,
    mine,
  } = props;

  const { mutes } = useChatContext("InlineMessageActions");
  const {
    customMessageActions,
    getMessageActions: contextGetMessageActions,
    handleDelete: contextHandleDelete,
    handleFlag: contextHandleFlag,
    handleMarkUnread: contextHandleMarkUnread,
    handleMute: contextHandleMute,
    handlePin: contextHandlePin,
    isMyMessage,
    message: contextMessage,
    threadList,
  } = useMessageContext("InlineMessageActions");
  const { CustomMessageActionsList } = useComponentContext("InlineMessageActions");
  const { t } = useTranslationContext("InlineMessageActions");
  const { setEditingMessage } = useInlineComposer();
  const messageComposer = useMessageComposer();

  const getMessageActions = propGetMessageActions || contextGetMessageActions;
  const handleDelete = propHandleDelete || contextHandleDelete;
  const handleFlag = propHandleFlag || contextHandleFlag;
  const handleMarkUnread = propHandleMarkUnread || contextHandleMarkUnread;
  const handleMute = propHandleMute || contextHandleMute;
  const handlePin = propHandlePin || contextHandlePin;
  const message = propMessage || contextMessage;
  const isMine = mine ? mine() : isMyMessage();
  const isMuted = useCallback(() => isUserMuted(message, mutes), [message, mutes]);

  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);

  const dialogIsOpen = open;

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const handleEdit = useCallback(
    (event) => {
      event?.preventDefault?.();
      if (!message) return;
      // Block editing for poll messages
      if (isPollMessage(message)) return;
      setEditingMessage(message);
      close();
    },
    [close, message, setEditingMessage]
  );

  const handleReply = useCallback(
    (event) => {
      event?.preventDefault?.();
      if (!message || !messageComposer?.setQuotedMessage) return;
      messageComposer.setQuotedMessage(message);
      close();

      // Focus composer
      const textarea = document.querySelector(".str-chat__textarea__textarea");
      if (textarea instanceof HTMLTextAreaElement) {
        textarea.focus();
      }
    },
    [close, message, messageComposer]
  );

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

  const messageActions = getMessageActions();
  const renderMessageActions = shouldRenderMessageActions({
    customMessageActions,
    CustomMessageActionsList,
    inThread: threadList,
    messageActions,
  });

  if (!renderMessageActions) return null;

  return (
    <MessageActionsWrapper
      customWrapperClass={customWrapperClass}
      inline={inline}
    >
      <PopoverPortal
        open={open}
        anchorRef={buttonRef}
        popoverRef={popoverRef}
        className="inline-message-actions-popover"
        zIndex={3000}
        placement={isMine ? "top-end" : "top-start"}
      >
        <CustomMessageActionsBox
          getMessageActions={getMessageActions}
          handleDelete={handleDelete}
          handleEdit={handleEdit}
          handleFlag={handleFlag}
          handleMarkUnread={handleMarkUnread}
          handleMute={handleMute}
          handlePin={handlePin}
          handleReply={handleReply}
          isUserMuted={isMuted}
          mine={isMine}
          open={dialogIsOpen}
        />
      </PopoverPortal>
      <button
        type="button"
        aria-expanded={dialogIsOpen}
        aria-haspopup="true"
        aria-label={t("aria/Open Message Actions Menu")}
        className="str-chat__message-actions-box-button message-circle-action-button"
        data-testid="message-actions-toggle-button"
        onClick={toggle}
        ref={buttonRef}
      >
        <ActionsIcon
          className="str-chat__message-action-icon message-ellipsis-icon"
          size={18}
          aria-hidden="true"
        />
      </button>
    </MessageActionsWrapper>
  );
};

export default InlineMessageActions;
