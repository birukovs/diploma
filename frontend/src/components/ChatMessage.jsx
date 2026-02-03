import { useLayoutEffect, useMemo, useRef } from "react";
import {
  Attachment,
  useMessageContext,
  useTranslationContext,
} from "stream-chat-react";
import { Smile } from "lucide-react";
import InlineMessageOptions from "./InlineMessageOptions";
import InlineQuotedMessage from "./InlineQuotedMessage";
import PollMessageCard from "./PollMessageCard";
import { isSystemUser } from "../lib/userUtils";
import "../styles/chat-message.css";

const createURLRegex = () => /(https?:\/\/[^\s]+|www\.[^\s]+|localhost:\d+[^\s]*)/gi;

// Reaction type to emoji mapping
const REACTION_EMOJI = {
  love: "❤️",
  like: "👍",
  haha: "😂",
  wow: "😮",
  sad: "😢",
  angry: "😡",
};

const toEmoji = (type) => REACTION_EMOJI[type] ?? type;

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

const ChatMessage = (props) => {
  const { message, isMyMessage, handleReaction } = useMessageContext("ChatMessage");
  const { userLanguage } = useTranslationContext("ChatMessage");
  const rowRef = useRef(null);

  const isDeleted =
    message?.type === "deleted" || Boolean(message?.deleted_at);

  // Get reactions for meta display with user lists - sorted by count DESC (most popular first/left)
  const reactions = useMemo(() => {
    if (!message?.reaction_groups) return [];
    const latestReactions = message.latest_reactions || [];

    // Build entries with counts
    const entries = Object.entries(message.reaction_groups);

    // Sort by count DESC, then alphabetically for stability
    entries.sort((a, b) => {
      const countA = a[1]?.count ?? 0;
      const countB = b[1]?.count ?? 0;
      if (countB !== countA) return countB - countA; // DESC by count
      return String(a[0]).localeCompare(String(b[0])); // ASC alphabetically
    });

    return entries
      .map(([type, data]) => {
        if (!data?.count) return null;

        // Build user list for this reaction type, filtering out system users
        const users = latestReactions
          .filter(r => r.type === type && !isSystemUser(r.user))
          .map(r => r.user?.name || r.user?.id || r.user_id || "Unknown")
          .filter((name, index, arr) => arr.indexOf(name) === index) // unique
          .slice(0, 5);

        const extra = Math.max(0, data.count - users.length);

        return {
          type,
          count: data.count,
          users,
          extra,
        };
      })
      .filter(Boolean);
  }, [message]);

  const { timeLabel, editedLabel } = useMemo(() => {
    if (!message) return { timeLabel: "", editedLabel: "" };

    const createdAtValue =
      message.created_at ||
      message.createdAt ||
      message.local_created_at ||
      message.updated_at;
    const createdAt = createdAtValue ? new Date(createdAtValue) : null;
    let label = formatMetaTime(createdAt, userLanguage);
    if (!label && createdAtValue) {
      label = String(createdAtValue);
    }

    const createdAtRaw =
      message.created_at || message.createdAt || message.local_created_at;
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
    const createdAtTime = createdAtRaw ? new Date(createdAtRaw).getTime() : 0;
    const editedAtTime = editedAtRaw ? new Date(editedAtRaw).getTime() : 0;
    const updatedAtTime = updatedAtRaw ? new Date(updatedAtRaw).getTime() : 0;
    const updatedAtEdited =
      createdAtTime > 0 &&
      updatedAtTime > 0 &&
      updatedAtTime > createdAtTime + 1000;
    const isEdited =
      Boolean(editedFlag) ||
      (Boolean(editedAtRaw) &&
        createdAtTime > 0 &&
        editedAtTime > createdAtTime) ||
      (!editedFlag && !editedAtRaw && updatedAtEdited);

    const edited = !isDeleted && isEdited
      ? userLanguage === "ru"
        ? "Отредактировано"
        : "Edited"
      : "";
    return { timeLabel: label, editedLabel: edited };
  }, [message, userLanguage, isDeleted]);

  useLayoutEffect(() => {
    const node = rowRef.current;
    if (!node || !message?.id) return;
    const li = node.closest("li");
    if (li) {
      li.classList.add("chat-row-host");
      const firstChild = li.firstElementChild;
      if (firstChild instanceof HTMLElement) {
        firstChild.classList.add("chat-row-host");
      }
    }
  }, [message?.id]);

  if (!message) return null;

  const isMine = isMyMessage?.() ?? false;

  const renderText = (text) => {
    if (!text) return null;
    const urlRegex = createURLRegex();
    const parts = [];
    let lastIndex = 0;
    let match;
    let keyIndex = 0;
    while ((match = urlRegex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (start > lastIndex) {
        parts.push(text.slice(lastIndex, start));
      }
      const raw = match[0];
      const href =
        raw.startsWith("http://") || raw.startsWith("https://")
          ? raw
          : `http://${raw}`;
      parts.push(
        <a
          key={`link-${keyIndex++}`}
          href={href}
          target="_blank"
          rel="noreferrer"
        >
          {raw}
        </a>
      );
      lastIndex = end;
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    return parts;
  };

  // Attachments (images, files, etc.)
  const attachments = message?.attachments ?? [];

  // Check for poll - either Stream SDK poll or fallback custom poll
  const poll = message?.poll;
  const fallbackPoll = message?.poll_data;
  const isFallbackPoll = message?.custom_type === "poll" && Boolean(fallbackPoll);

  // Validate poll data exists and is not empty
  const hasPollData = Boolean(poll?.id) || (isFallbackPoll && fallbackPoll?.question && Array.isArray(fallbackPoll?.options));
  const hasPoll = !isDeleted && hasPollData;

  // Filter out poll attachments (we render them separately)
  const nonPollAttachments = attachments.filter(
    (attachment) => attachment.type !== "poll"
  );

  // For fallback polls, don't show the text (it's just the emoji prefix)
  // Also hide text for deleted poll messages
  const showText = !isFallbackPoll || isDeleted;

  // For deleted messages (including polls), show deleted placeholder
  // For poll messages that exist, hide empty text
  const isPollMessage = isFallbackPoll || Boolean(poll);
  const bodyText = isDeleted
    ? userLanguage === "ru"
      ? "Сообщение было удалено."
      : "Message was deleted."
    : (isPollMessage && !message?.text) ? "" : (message?.text || "");

  const actionsSlot = !isDeleted ? (
    <div className="chat-actions-slot">
      <div className="chat-actions">
        <InlineMessageOptions {...props} ReactionIcon={Smile} />
      </div>
    </div>
  ) : null;

  const contentSlot = (
    <div className="chat-message-content">
      <div className="chat-bubble" data-chat-message="1">
        {!isDeleted && <InlineQuotedMessage />}
        {/* Text content - hide for fallback polls (just emoji prefix) */}
        {bodyText && showText && <div className="chat-text">{renderText(bodyText)}</div>}
        {/* Poll - Stream SDK or fallback (PollMessageCard handles both) */}
        {!isDeleted && hasPoll && <PollMessageCard poll={poll} />}
        {/* Attachments (images, files) */}
        {!isDeleted && nonPollAttachments.length > 0 && (
          <div className="chat-attachments" data-ui="attachments-v1">
            <Attachment attachments={nonPollAttachments} />
          </div>
        )}
      </div>
      {(timeLabel || editedLabel || (!isDeleted && reactions.length > 0)) && (
        <div className={`chat-meta ${isMine ? "mine" : "other"}`}>
          {isMine && !isDeleted && reactions.length > 0 && (
            <span className="chat-meta-reactions">
              {reactions.map(({ type, count, users, extra }) => (
                <span key={type} className="reaction-wrap">
                  <button
                    type="button"
                    className="chat-meta-reaction"
                    onClick={(event) => handleReaction?.(type, event)}
                    aria-label={`React with ${type}`}
                  >
                    <span className="chat-meta-reaction-emoji">{toEmoji(type)}</span>
                    {count > 1 && <span className="chat-meta-reaction-count">{count}</span>}
                  </button>
                  <div className="reaction-tooltip">
                    {users.join(", ")}
                    {extra > 0 && ` + ${extra} ${userLanguage === "ru" ? "ещё" : "more"}`}
                  </div>
                </span>
              ))}
            </span>
          )}
          <span className="chat-time">{timeLabel}</span>
          {editedLabel && <span className="chat-edited"> • {editedLabel}</span>}
          <span data-ui="edited-logic-v2" style={{ display: "none" }} />
          {!isMine && !isDeleted && reactions.length > 0 && (
            <span className="chat-meta-reactions">
              {reactions.map(({ type, count, users, extra }) => (
                <span key={type} className="reaction-wrap">
                  <button
                    type="button"
                    className="chat-meta-reaction"
                    onClick={(event) => handleReaction?.(type, event)}
                    aria-label={`React with ${type}`}
                  >
                    <span className="chat-meta-reaction-emoji">{toEmoji(type)}</span>
                    {count > 1 && <span className="chat-meta-reaction-count">{count}</span>}
                  </button>
                  <div className="reaction-tooltip">
                    {users.join(", ")}
                    {extra > 0 && ` + ${extra} ${userLanguage === "ru" ? "ещё" : "more"}`}
                  </div>
                </span>
              ))}
              <span data-ui="reaction-tooltip-v1" style={{ display: "none" }} />
            </span>
          )}
          <span data-ui="reactions-order-v3" style={{ display: "none" }} />
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={rowRef}
      className={`chat-row ${isMine ? "my" : "other"}`}
      data-message-id={message.id}
    >
      {isMine && actionsSlot}
      {contentSlot}
      {!isMine && actionsSlot}
    </div>
  );
};

export default ChatMessage;
