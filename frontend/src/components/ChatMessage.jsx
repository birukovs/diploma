import { useLayoutEffect, useMemo, useRef } from "react";
import {
  Attachment,
  Avatar,
  useChannelStateContext,
  useMessageContext,
  useTranslationContext,
} from "stream-chat-react";
import { Smile } from "lucide-react";
import InlineMessageOptions from "./InlineMessageOptions";
import InlineQuotedMessage from "./InlineQuotedMessage";
import PollMessageCard from "./PollMessageCard";
import MessageMetaRow from "./MessageMetaRow";
import { isSystemUser } from "../lib/userUtils";
import "../styles/chat-message.css";

const createURLRegex = () => /(https?:\/\/[^\s]+|www\.[^\s]+|localhost:\d+[^\s]*)/gi;

// Соответствие типа реакции эмодзи
const REACTION_EMOJI = {
  love: "❤️",
  like: "👍",
  haha: "😂",
  wow: "😮",
  sad: "😢",
  angry: "😡",
};

const toEmoji = (type) => REACTION_EMOJI[type] ?? type;
const AUTHOR_REPEAT_EVERY = 6;

const isPollThreadMessage = (msg) =>
  msg?.custom_type === "poll_suggestion" ||
  msg?.custom_type === "poll_suggestion_shadow" ||
  msg?.custom_type === "poll_comment" ||
  msg?.poll_suggestion === true ||
  msg?.poll_comment === true ||
  msg?.extra_data?.poll_suggestion === true ||
  msg?.extra_data?.poll_comment === true ||
  msg?.extraData?.poll_suggestion === true ||
  msg?.extraData?.poll_comment === true;

const ChatMessage = (props) => {
  const { message, isMyMessage, handleReaction } = useMessageContext("ChatMessage");
  const { channel } = useChannelStateContext("ChatMessage");
  const { userLanguage } = useTranslationContext("ChatMessage");
  const rowRef = useRef(null);

  const isPollThreadMessageFlag = isPollThreadMessage(message);

  const isDeleted =
    message?.type === "deleted" || Boolean(message?.deleted_at);

  // Реакции для мета-отображения со списками пользователей — сортировка по убыванию (популярные слева)
  const reactions = useMemo(() => {
    if (isPollThreadMessageFlag || !message?.reaction_groups) return [];
    const latestReactions = message.latest_reactions || [];
    const isPollReaction = (type) => String(type || "").startsWith("poll:");

    // Формируем элементы с количеством
    const entries = Object.entries(message.reaction_groups).filter(
      ([type]) => !isPollReaction(type)
    );

    // Сортировка по убыванию, затем по алфавиту для стабильности
    entries.sort((a, b) => {
      const countA = a[1]?.count ?? 0;
      const countB = b[1]?.count ?? 0;
      if (countB !== countA) return countB - countA; // Убывание по количеству
      return String(a[0]).localeCompare(String(b[0])); // Возрастание по алфавиту
    });

    return entries
      .map(([type, data]) => {
        if (!data?.count) return null;

        // Список пользователей для типа реакции, исключая системных
        const users = latestReactions
          .filter(r => r.type === type && !isSystemUser(r.user))
          .map(r => r.user?.name || r.user?.id || r.user_id || "Unknown")
          .filter((name, index, arr) => arr.indexOf(name) === index) // уникальные
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
  }, [message, isPollThreadMessageFlag]);

  useLayoutEffect(() => {
    if (isPollThreadMessageFlag) return;
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
  }, [message?.id, isPollThreadMessageFlag]);

  const isMine = isMyMessage?.() ?? false;
  const showAuthor = useMemo(() => {
    if (isPollThreadMessageFlag) return false;
    if (isMine) return false;
    if (!message?.id) return true;
    const messagesInState = Array.isArray(channel?.state?.messages)
      ? channel.state.messages
      : [];
    const currentIndex = messagesInState.findIndex((msg) => msg?.id === message.id);
    if (currentIndex <= 0) return true;
    let consecutive = 0;
    for (let i = currentIndex - 1; i >= 0; i -= 1) {
      const prev = messagesInState[i];
      if (!prev) continue;
      if (prev.type === "system" || prev.type === "deleted" || prev.deleted_at) continue;
      if (isPollThreadMessage(prev)) continue;
      if (prev.user?.id !== message.user?.id) break;
      consecutive += 1;
    }
    if (consecutive === 0) return true;
    return consecutive % AUTHOR_REPEAT_EVERY === 0;
  }, [isMine, channel?.state?.messages, message?.id, message?.user?.id, isPollThreadMessageFlag]);

  if (!message || isPollThreadMessageFlag) return null;
  const authorName =
    message?.user?.name ||
    message?.user?.username ||
    message?.user?.id ||
    "Unknown";

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

  // Вложения (изображения, файлы и т.п.)
  const attachments = message?.attachments ?? [];

  // Проверяем опрос — либо Stream SDK, либо кастомный fallback
  const poll = message?.poll;
  const fallbackPoll = message?.poll_data;
  const isFallbackPoll = message?.custom_type === "poll" && Boolean(fallbackPoll);

  // Проверяем, что данные опроса есть и не пустые
  const hasPollData = Boolean(poll?.id) || (isFallbackPoll && fallbackPoll?.question && Array.isArray(fallbackPoll?.options));
  const hasPoll = !isDeleted && hasPollData;

  // Убираем вложения-опросы (рендерим отдельно)
  const nonPollAttachments = attachments.filter(
    (attachment) => attachment.type !== "poll"
  );

  // Для fallback-опросов не показываем текст (это просто emoji-префикс)
  // Также скрываем текст у удалённых сообщений-опросов
  const showText = !isFallbackPoll || isDeleted;

  // Для удалённых сообщений (включая опросы) показываем плейсхолдер удаления
  // Для сообщений-опросов скрываем пустой текст
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
    <div
      className={`chat-message-content${!isMine ? " from-other" : ""}${
        showAuthor ? " with-author" : ""
      }`}
    >
      {showAuthor && (
        <div className="chat-author">
          <Avatar
            image={message?.user?.image}
            name={authorName}
            className="chat-author-avatar"
          />
          <span className="chat-author-name">{authorName}</span>
        </div>
      )}
      <div className="chat-bubble" data-chat-message="1">
        {!isDeleted && <InlineQuotedMessage />}
        {/* Текст — скрываем для fallback-опросов (только emoji-префикс) */}
        {bodyText && showText && <div className="chat-text">{renderText(bodyText)}</div>}
        {/* Опрос — Stream SDK или fallback (PollMessageCard обрабатывает оба) */}
        {!isDeleted && hasPoll && <PollMessageCard poll={poll} />}
        {/* Вложения (изображения, файлы) */}
        {!isDeleted && nonPollAttachments.length > 0 && (
          <div className="chat-attachments" data-ui="attachments-v1">
            <Attachment attachments={nonPollAttachments} />
          </div>
        )}
      </div>
      <MessageMetaRow
        message={message}
        isMine={isMine}
        userLanguage={userLanguage}
        isDeleted={isDeleted}
        reactions={reactions}
        handleReaction={handleReaction}
        toEmoji={toEmoji}
      />
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
