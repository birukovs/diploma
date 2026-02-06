import { useMemo, useEffect } from "react";
import { useChannelStateContext, useChatContext } from "stream-chat-react";

// Глобальное хранилище базовых хэшей текста (ключ — message.id)
const baselineTextMap = new Map();

// Нормализуем текст для сравнения (trim + схлопывание пробелов)
const normalizeText = (text) => {
  if (!text) return "";
  return text.trim().replace(/\s+/g, " ");
};

// Форматируем время для отображения
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

// Иконки статуса прочтения
const CheckIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const DoubleCheckIcon = ({ read }) => (
  <svg
    width="18"
    height="14"
    viewBox="0 0 28 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ color: read ? "#4ade80" : "currentColor" }}
  >
    <polyline points="20 6 9 17 4 12" />
    <polyline points="28 6 17 17 14 14" />
  </svg>
);

const displayName = (user, fallbackId = "") => {
  if (!user) return fallbackId;
  if (typeof user === "string") return user;
  const name = String(user.name || "").trim();
  if (name) return name;
  const first = user.first_name || user.firstName || "";
  const last = user.last_name || user.lastName || "";
  const full = `${first} ${last}`.trim();
  if (full) return full;
  const username = String(user.username || user.user_name || "").trim();
  if (username) return username;
  const id = user.id || user.userId || fallbackId;
  return id ? String(id) : "";
};

const ReadIndicator = ({ isMine, isDeleted, readStatus, userLanguage }) => {
  if (!isMine || isDeleted) return null;

  const { status, readers, readCount } = readStatus;

  if (status === "none") return null;

  if (status === "sent") {
    return (
      <span
        className="read-indicator read-sent"
        title={userLanguage === "ru" ? "Отправлено" : "Sent"}
      >
        <CheckIcon />
      </span>
    );
  }

  if (status === "delivered") {
    return (
      <span
        className="read-indicator read-delivered"
        title={userLanguage === "ru" ? "Доставлено" : "Delivered"}
      >
        <DoubleCheckIcon read={false} />
      </span>
    );
  }

  if (status === "read") {
    const readerNames = readers
      .map((u) => displayName(u, u?.id))
      .filter(Boolean);
    const firstReader = readerNames[0] || "";
    const tooltip =
      readerNames.join(", ") || (userLanguage === "ru" ? "Прочитано" : "Read");

    return (
      <span className="read-indicator read-read read-group" title={tooltip}>
        <DoubleCheckIcon read={true} />
        {firstReader && (
          <span className="read-names">
            {firstReader}
            {readCount > 1 ? ` +${readCount - 1}` : ""}
          </span>
        )}
      </span>
    );
  }

  return null;
};

const MessageMetaRow = ({
  message,
  isMine,
  userLanguage,
  isDeleted,
  reactions,
  handleReaction,
  toEmoji,
}) => {
  const { client } = useChatContext();
  const { read, channel } = useChannelStateContext();
  const currentUserId = client?.user?.id || client?.userID;

  // Инициализируем базовый текст при первом рендере
  useEffect(() => {
    if (!message?.id) return;
    if (!baselineTextMap.has(message.id)) {
      baselineTextMap.set(message.id, normalizeText(message.text));
    }
  }, [message?.id, message?.text]);

  // Определяем, было ли сообщение реально отредактировано (текст изменён, не реакции/пины)
  const isTextEdited = useMemo(() => {
    if (!message || isDeleted || !message.text) return false;

    const createdAtRaw = message.created_at || message.createdAt || message.local_created_at;
    const updatedAtRaw = message.updated_at || message.updatedAt;

    if (!updatedAtRaw || !createdAtRaw) return false;

    const createdAt = new Date(createdAtRaw).getTime();
    const updatedAt = new Date(updatedAtRaw).getTime();

    // Разница должна быть минимум 2 секунды, чтобы отсеять серверные нюансы
    if (updatedAt <= createdAt + 2000) return false;

    // 1. Проверяем флаг text_edited (сохраняется на сервере)
    if (message.text_edited === true) {
      return true;
    }

    // 2. Проверяем localStorage (надёжно при перезагрузке)
    try {
      const editedMessages = JSON.parse(localStorage.getItem("edited_messages") || "{}");
      if (editedMessages[message.id]) {
        return true;
      }
    } catch {
      // Игнорируем ошибки localStorage
    }

    // 3. Реальное время: сравнение текущего текста с базовым
    const currentNormalized = normalizeText(message.text);
    const baseline = baselineTextMap.get(message.id);

    if (baseline !== undefined && currentNormalized !== baseline) {
      // Обновляем базу и сохраняем в localStorage
      baselineTextMap.set(message.id, currentNormalized);
      try {
        const editedMessages = JSON.parse(localStorage.getItem("edited_messages") || "{}");
        editedMessages[message.id] = new Date().toISOString();
        localStorage.setItem("edited_messages", JSON.stringify(editedMessages));
      } catch {
        // Игнорируем ошибки localStorage
      }
      return true;
    }

    return false;
  }, [message, isDeleted]);

  // Вычисляем статус прочтения для своих сообщений
  const readStatus = (() => {
    if (!isMine || !message || isDeleted) {
      return { status: "none", readers: [], readCount: 0 };
    }

    const messageCreatedAt = message.created_at || message.createdAt || message.local_created_at;
    if (!messageCreatedAt) {
      return { status: "sent", readers: [], readCount: 0 };
    }
    const currentMessageTime = new Date(messageCreatedAt).getTime();

    // Количество участников канала (кроме себя)
    const members = channel?.state?.members || {};
    const otherMembersCount = Object.keys(members).filter((id) => id !== currentUserId).length;
    // Находим пользователей, прочитавших это сообщение
    const readersMap = new Map();
    const readBy = Array.isArray(message?.read_by) ? message.read_by : null;
    const hasReadBy = !!(readBy && readBy.length > 0);

    const messagesInState = Array.isArray(channel?.state?.messages)
      ? channel.state.messages
      : [];
    const ownMessages = messagesInState.filter(
      (msg) => msg?.id && msg.user?.id === currentUserId && msg.created_at
    );

    if (hasReadBy) {
      readBy.forEach((entry) => {
        const entryUser = entry?.user || entry;
        const entryUserId = entryUser?.id || entry?.user_id || entry?.id;
        if (!entryUserId || entryUserId === currentUserId) return;

        const resolvedUser =
          entryUser ||
          channel?.state?.members?.[entryUserId]?.user ||
          client?.state?.users?.[entryUserId] ||
          { id: entryUserId };

        readersMap.set(String(entryUserId), resolvedUser);
      });
    }

    if (read) {
      Object.entries(read).forEach(([readKey, readState]) => {
        const readUser = readState?.user;
        const readUserId = readUser?.id || readState?.user_id || readKey;
        if (!readUserId || readUserId === currentUserId) return;

        const hasIdentity =
          readUser &&
          (readUser.id ||
            readUser.name ||
            readUser.username ||
            readUser.first_name ||
            readUser.last_name);
        const resolvedUser =
          (hasIdentity ? readUser : null) ||
          channel?.state?.members?.[readUserId]?.user ||
          client?.state?.users?.[readUserId] ||
          { id: readUserId };

        const lastReadMessageId =
          readState?.lastReadMessageId ||
          readState?.last_read_message_id ||
          readState?.last_read_message?.id;

        let lastReadTime = NaN;
        if (lastReadMessageId) {
          const lastReadMsg = ownMessages.find(
            (msg) => String(msg.id) === String(lastReadMessageId)
          );
          if (lastReadMsg?.created_at) {
            lastReadTime = new Date(lastReadMsg.created_at).getTime();
          }
        }

        if (Number.isNaN(lastReadTime)) {
          const lastReadAt =
            readState?.lastReadAt ||
            readState?.last_read ||
            readState?.last_read_at;
          if (lastReadAt) {
            lastReadTime = new Date(lastReadAt).getTime();
          }
        }

        if (Number.isNaN(lastReadTime)) return;
        if (currentMessageTime > lastReadTime) return;
        readersMap.set(String(readUserId), resolvedUser);
      });
    }

    const readers = Array.from(readersMap.values());
    const readCount = readers.length;

    // Определяем статус
    let status = "sent"; // по умолчанию: отправлено на сервер

    if (message.status === "received" || message.status === "sent") {
      status = "sent";
    }

    if (readCount > 0) {
      status = "read";
    } else if (otherMembersCount > 0 && message.status !== "sending" && message.status !== "failed") {
      // Доставлено = отправлено и есть другие участники, но ещё не прочитано
      status = "delivered";
    }

    return { status, readers, readCount, otherMembersCount };
  })();


  // Метка времени
  const timeLabel = useMemo(() => {
    if (!message) return "";
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
    return label;
  }, [message, userLanguage]);

  const editedLabel = isTextEdited
    ? userLanguage === "ru"
      ? "Отредактировано"
      : "Edited"
    : "";

  useEffect(() => {
    if (!isMine || typeof window === "undefined") return;
    window.__readDebug = {
      messageId: message?.id,
      readBy: message?.read_by,
      readState: read,
      members: channel?.state?.members,
    };
  }, [
    isMine,
    message?.id,
    message?.read_by,
    read,
    channel?.state?.members,
  ]);

  if (!timeLabel && !editedLabel && (!reactions || reactions.length === 0)) {
    return null;
  }

  return (
    <div className={`chat-meta ${isMine ? "mine" : "other"}`}>
      {isMine && !isDeleted && reactions && reactions.length > 0 && (
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

      {/* Индикатор прочтения (только для своих сообщений, перед временем) */}
      <ReadIndicator
        isMine={isMine}
        isDeleted={isDeleted}
        readStatus={readStatus}
        userLanguage={userLanguage}
      />

      <span className="chat-time">{timeLabel}</span>

      {editedLabel && <span className="chat-edited"> • {editedLabel}</span>}

      {!isMine && !isDeleted && reactions && reactions.length > 0 && (
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
    </div>
  );
};

export default MessageMetaRow;
