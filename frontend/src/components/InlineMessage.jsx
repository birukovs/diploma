import { useLayoutEffect, useMemo, useRef } from "react";
import {
  MessageText as DefaultMessageText,
  useComponentContext,
  useMessageContext,
  useTranslationContext,
} from "stream-chat-react";
import InlineMessageOptions from "./InlineMessageOptions";
import InlineQuotedMessage from "./InlineQuotedMessage";
import "../styles/chat-message.css";

const formatMetaTime = (date, locale) => {
  if (!date) return "";
  const language = locale || "en";
  try {
    const dtf = new Intl.DateTimeFormat(
      language === "ru" ? "ru-RU" : language,
      {
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
    const parts = dtf.formatToParts(date);
    const weekday = parts.find((part) => part.type === "weekday")?.value;
    const time = parts
      .filter((part) => part.type === "hour" || part.type === "minute")
      .map((part) => part.value)
      .join(":");
    if (weekday && time) {
      return language === "ru" ? `${weekday} в ${time}` : `${weekday} ${time}`;
    }
    return dtf.format(date);
  } catch {
    return date.toLocaleString();
  }
};

const InlineMessage = (props) => {
  const { message, isMyMessage } = useMessageContext("InlineMessage");
  const { MessageOptions: ContextMessageOptions, MessageText } =
    useComponentContext("InlineMessage");
  const { userLanguage } = useTranslationContext("InlineMessage");

  const rowRef = useRef(null);

  const { timeLabel, editedLabel } = useMemo(() => {
    if (!message) return { timeLabel: "", editedLabel: "" };

    const createdAtRaw = message.created_at || message.createdAt || message.local_created_at;
    const editedAtRaw =
      message.edited_at ||
      message.editedAt ||
      message.text_updated_at ||
      message.textUpdatedAt ||
      null;
    const updatedAtRaw =
      message.updated_at ||
      message.updatedAt ||
      null;
    const editedFlag =
      message.edited === true ||
      message.extraData?.edited ||
      message.extra_data?.edited ||
      false;
    const createdAt = createdAtRaw ? new Date(createdAtRaw) : null;
    const editedAt = editedAtRaw ? new Date(editedAtRaw) : null;
    const updatedAt = updatedAtRaw ? new Date(updatedAtRaw) : null;
    const updatedAtEdited = Boolean(
      createdAt &&
      updatedAt &&
      updatedAt.getTime() > createdAt.getTime() + 1000
    );
    const isEdited =
      Boolean(editedFlag) ||
      Boolean(createdAt && editedAt && editedAt.getTime() > createdAt.getTime()) ||
      (!editedFlag && !editedAtRaw && updatedAtEdited);
    const label = formatMetaTime(createdAt, userLanguage);
    const edited = isEdited
      ? userLanguage === "ru"
        ? "Отредактировано"
        : "Edited"
      : "";
    return { timeLabel: label, editedLabel: edited };
  }, [message, userLanguage]);

  useLayoutEffect(() => {
    const node = rowRef.current;
    if (!node || !message?.id) return;
    const li = node.closest("li");
    if (li) {
      li.classList.add("chat-message-row-host");
      const firstChild = li.firstElementChild;
      if (firstChild instanceof HTMLElement) {
        firstChild.classList.add("chat-message-row-host");
      }
    }
  }, [message?.id]);

  if (!message) return null;

  const isMine = isMyMessage?.() ?? false;
  const MessageOptions = ContextMessageOptions || InlineMessageOptions;
  const MessageTextComponent = MessageText || DefaultMessageText;

  return (
    <div
      ref={rowRef}
      className={`chat-message-row ${isMine ? "my" : "other"}`}
      data-message-id={message.id}
    >
      <div
        className="str-chat__message-bubble chat-message-bubble"
        data-chat-message="1"
      >
        <InlineQuotedMessage />
        <div className="chat-message-text">
          <MessageTextComponent message={message} {...props} />
        </div>
      </div>
      {(timeLabel || editedLabel) && (
        <div className="chat-message-meta">
          <span>{timeLabel}</span>
          {editedLabel && <span> • {editedLabel}</span>}
        </div>
      )}
      <MessageOptions {...props} />
    </div>
  );
};

export default InlineMessage;
