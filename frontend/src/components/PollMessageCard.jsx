import { useState, useCallback, useMemo, useEffect, useRef } from "react";

import { createPortal } from "react-dom";

import { useMessageContext, useChatContext, useChannelStateContext } from "stream-chat-react";

import { MessageSquare, Plus, X, Send } from "lucide-react";

import toast from "react-hot-toast";

import "../styles/polls.css";



const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};
const POLL_REACTION_PREFIX = "poll:";
const MAX_REACTION_TYPE_LEN = 30;
const MAX_OPTION_ID_LEN = MAX_REACTION_TYPE_LEN - POLL_REACTION_PREFIX.length;

const hashToBase36 = (value) => {
  const str = String(value || "");
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const unsigned = hash >>> 0;
  return unsigned.toString(36);
};

const isTrueish = (value) => {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
};

const normalizeOptionId = (rawId) => {
  const safe = String(rawId || "").trim();
  if (!safe) return "";
  if (safe.length <= MAX_OPTION_ID_LEN) return safe;
  const hashed = `h_${hashToBase36(safe)}`;
  return hashed.length <= MAX_OPTION_ID_LEN
    ? hashed
    : hashed.slice(0, MAX_OPTION_ID_LEN);
};

const normalizeOptionText = (value) => {
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
  return normalized ? normalized.toLowerCase() : "";
};

const suggestionOptionId = (replyId) => {
  const raw = String(replyId || "");
  if (!raw) return "";
  const maxRawLength = MAX_OPTION_ID_LEN - 4;
  if (raw.length <= maxRawLength) return `sug_${raw}`;
  const base = hashToBase36(raw);
  if (!base) return "";
  const id = `sug_${base}`;
  return id.length <= MAX_OPTION_ID_LEN ? id : id.slice(0, MAX_OPTION_ID_LEN);
};

const createSuggestionOptionId = () => {
  const raw = `sug_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  return normalizeOptionId(raw);
};

const getPollAttachment = (msg, type) => {
  if (!msg || !type) return null;
  const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
  return attachments.find((item) => item?.type === type) || null;
};

const fetchThreadReplies = async ({ channel, client, messageId, cid }) => {
  if (!messageId) return [];

  const resolvedCid = cid || channel?.cid || "";
  const tryGetReplies = async (chan) => {
    if (!chan?.getReplies) return null;
    const response = await chan.getReplies(messageId, { limit: 100 });
    return Array.isArray(response?.messages) ? response.messages : [];
  };

  try {
    const primary = await tryGetReplies(channel);
    if (primary !== null && primary.length > 0) return primary;
    if (primary !== null && !client?.search) return primary;
  } catch {
    // переходим к поисковому fallback
  }

  if (client?.getReplies) {
    try {
      const response = await client.getReplies(messageId, { limit: 100 });
      const messages = Array.isArray(response?.messages) ? response.messages : [];
      if (messages.length > 0) return messages;
    } catch {
      // игнорируем и пробуем поиск
    }
  }

  if (client && resolvedCid && client.channel) {
    try {
      const [type, id] = resolvedCid.split(":");
      if (type && id) {
        const tempChannel = client.channel(type, id);
        const fallback = await tryGetReplies(tempChannel);
        if (fallback !== null && fallback.length > 0) return fallback;
      }
    } catch {
      // игнорируем и пробуем поиск
    }
  }


  return [];
};

const getThreadRepliesFromState = (channel, messageId) => {
  if (!channel?.state || !messageId) return [];
  const threads = channel.state.threads;
  if (!threads) return [];
  if (Array.isArray(threads?.[messageId])) return threads[messageId];
  if (Array.isArray(threads?.[String(messageId)])) return threads[String(messageId)];
  if (threads instanceof Map) {
    const fromMap = threads.get(messageId) || threads.get(String(messageId));
    return Array.isArray(fromMap) ? fromMap : [];
  }
  return [];
};

const getSuggestionOptionId = (reply) => {
  const extra = reply?.extraData || reply?.extra_data || EMPTY_OBJECT;
  const attachment = getPollAttachment(reply, "poll_suggestion");
  const attachmentOptionId = attachment?.poll_option_id;
  if (attachmentOptionId) {
    const safe = String(attachmentOptionId || "").trim();
    if (!safe) return "";
    if (safe.length <= MAX_OPTION_ID_LEN) return safe;
    return normalizeOptionId(safe);
  }
  const fromExtra = reply?.poll_option_id ?? extra.poll_option_id;
  if (fromExtra) {
    const safe = String(fromExtra || "").trim();
    if (!safe) return "";
    if (safe.length <= MAX_OPTION_ID_LEN) return safe;
    return normalizeOptionId(safe);
  }
  return suggestionOptionId(reply?.id);
};

const isShadowSuggestion = (msg) => {
  if (!msg) return false;
  if (msg.custom_type === "poll_suggestion_shadow") return true;
  const extra = msg.extraData || msg.extra_data || EMPTY_OBJECT;
  return isTrueish(msg.poll_shadow) || isTrueish(extra.poll_shadow);
};


const displayName = (user) => {

  if (!user) return "Unknown";

  if (typeof user === "string") return user;

  const name = String(user.name || "").trim();

  if (name) return name;

  const first = user.first_name || user.firstName || "";

  const last = user.last_name || user.lastName || "";

  const fullName = `${first} ${last}`.trim();

  if (fullName) return fullName;

  const username = String(user.username || user.user_name || user.handle || "").trim();

  if (username) return username;

  const id = user.id || user.userId || "";

  return id ? String(id) : "Unknown";

};




// СТРОГИЙ фильтр: только poll_suggestion === true и совпадает poll_message_id
const isSuggestionReply = (msg, pollMessageId) => {
  if (!msg || !pollMessageId) return false;
  if (String(msg.parent_id) !== String(pollMessageId)) return false;
  const extra = msg.extraData || msg.extra_data || EMPTY_OBJECT;
  const suggestionAttachment = getPollAttachment(msg, "poll_suggestion");
  const commentAttachment = getPollAttachment(msg, "poll_comment");
  const hasSuggestionFlag =
    isTrueish(msg.poll_suggestion) ||
    isTrueish(extra.poll_suggestion);
  const hasSuggestionId =
    msg.poll_option_id != null ||
    extra.poll_option_id != null;
  const hasSuggestionAttachment = Boolean(suggestionAttachment);
  const hasSuggestionType = msg.custom_type === "poll_suggestion";
  if (
    !hasSuggestionFlag &&
    !hasSuggestionId &&
    !hasSuggestionAttachment &&
    !hasSuggestionType
  ) {
    return false;
  }
  if (
    isTrueish(msg.poll_comment) ||
    isTrueish(extra.poll_comment) ||
    commentAttachment ||
    msg.custom_type === "poll_comment"
  ) {
    return false;
  }
  if (isTrueish(msg.poll_sync_ping) || isTrueish(extra.poll_sync_ping)) return false;
  return true;
};


const getSuggestionText = (reply) => String(reply?.text ?? "").trim();



// СТРОГИЙ фильтр: только poll_comment === true, исключаем предложения и sync ping

const isCommentReply = (msg, pollMessageId) => {

  if (!msg || String(msg.parent_id) !== String(pollMessageId)) return false;

  // Должен быть явный флаг poll_comment

  const hasCommentFlag =

    isTrueish(msg.poll_comment) ||

    isTrueish(msg.extraData?.poll_comment) ||

    isTrueish(msg.extra_data?.poll_comment);
  const hasCommentAttachment = Boolean(getPollAttachment(msg, "poll_comment"));

  if (!hasCommentFlag && !hasCommentAttachment && msg.custom_type !== "poll_comment") return false;

  // НЕ должен быть предложением

  if (
    isTrueish(msg.poll_suggestion) ||
    isTrueish(msg.extraData?.poll_suggestion) ||
    isTrueish(msg.extra_data?.poll_suggestion) ||
    getPollAttachment(msg, "poll_suggestion") ||
    msg.custom_type === "poll_suggestion"
  ) {
    return false;
  }

  // НЕ должен быть sync ping

  if (
    isTrueish(msg.poll_sync_ping) ||
    isTrueish(msg.extraData?.poll_sync_ping) ||
    isTrueish(msg.extra_data?.poll_sync_ping)
  ) {
    return false;
  }

  return true;

};

const isLooseCommentReply = (msg, pollMessageId) => {
  if (!msg) return false;
  if (String(msg.parent_id) !== String(pollMessageId)) return false;
  if (isSuggestionReply(msg, pollMessageId)) return false;
  const extra = msg.extraData || msg.extra_data || EMPTY_OBJECT;
  if (
    isTrueish(msg.poll_sync_ping) ||
    isTrueish(extra.poll_sync_ping)
  ) {
    return false;
  }
  return true;
};

const isLooseSuggestionReply = (msg, pollMessageId) => {
  if (!msg) return false;
  if (String(msg.parent_id) !== String(pollMessageId)) return false;
  if (isSuggestionReply(msg, pollMessageId)) return false;
  if (isCommentReply(msg, pollMessageId)) return false;
  const extra = msg.extraData || msg.extra_data || EMPTY_OBJECT;
  if (
    isTrueish(msg.poll_sync_ping) ||
    isTrueish(extra.poll_sync_ping)
  ) {
    return false;
  }
  return true;
};



// ========== МОДАЛКА ПРЕДЛОЖЕНИЙ ==========

const SuggestionsModal = ({ pollData, onClose, onAddOption }) => {

  const [text, setText] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const inputRef = useRef(null);



  useEffect(() => {

    inputRef.current?.focus();

  }, []);



  const trimmed = text.trim();

  const isValid = trimmed.length >= 1 && trimmed.length <= 80;



  const handleSubmit = async (e) => {

    e?.preventDefault();

    if (!isValid || submitting) return;

    setSubmitting(true);

    try {

      const result = await onAddOption(trimmed);
      if (result !== false) onClose();

    } catch (err) {

      console.error("Add option error:", err);

    } finally {

      setSubmitting(false);

    }

  };



  const handleBackdrop = (e) => {

    if (e.target === e.currentTarget) onClose();

  };



  const options = pollData?.options || [];

  const question = pollData?.question || "";



  if (!pollData || !options.length || !question) return null;

  if (typeof document === "undefined") return null;
  const portalTarget = document.querySelector(".chat-main") || document.body;

  return createPortal(

    <div className="poll-modal-overlay poll-modal-overlay--local" onClick={handleBackdrop}>

      <div className="poll-modal" onClick={(e) => e.stopPropagation()}>

        <div className="poll-modal-header">

          <h4>Предложить вариант</h4>

          <button type="button" className="poll-modal-close" onClick={onClose}>

            <X size={18} />

          </button>

        </div>

        <form onSubmit={handleSubmit} className="poll-modal-body">

          <input

            ref={inputRef}

            type="text"

            value={text}

            onChange={(e) => setText(e.target.value)}

            placeholder="Введите вариант (1-80 символов)"

            className="poll-modal-input"

            maxLength={80}

          />

          <div className="poll-modal-footer">

            <button type="button" className="poll-modal-btn poll-modal-btn-secondary" onClick={onClose}>

              Отмена

            </button>

            <button

              type="submit"

              className="poll-modal-btn poll-modal-btn-primary"

              disabled={!isValid || submitting}

            >

              {submitting ? "Добавление..." : "Добавить"}

            </button>

          </div>

        </form>

      </div>

    </div>,
    portalTarget
  );

};



// ========== МОДАЛКА КОММЕНТАРИЕВ ==========

const CommentsModal = ({ messageId, onClose, commentsCount, allowLooseComments }) => {

  const { channel } = useChannelStateContext("CommentsModal");

  const { client } = useChatContext("CommentsModal");



  const [comments, setComments] = useState([]);

  const [loading, setLoading] = useState(true);

  const [newComment, setNewComment] = useState("");

  const [sending, setSending] = useState(false);

  const inputRef = useRef(null);

  const listRef = useRef(null);

  const [commentUserCache, setCommentUserCache] = useState({});

  const commentUserInFlight = useRef(new Set());



  const appendComment = useCallback((comment) => {

    if (!comment?.id) return;

    setComments((prev) => {

      if (prev.some((item) => item.id === comment.id)) return prev;

      return [...prev, comment];

    });

  }, []);



  // Загружаем ответы треда при монтировании

  useEffect(() => {

    const loadComments = async () => {

      if (!channel || !messageId) {

        setLoading(false);

        return;

      }

      try {

        // Загружаем ответы треда для этого сообщения

        const replies = await fetchThreadReplies({
          channel,
          client,
          messageId,
        });
        const strict = replies.filter((msg) => isCommentReply(msg, messageId));
        if (!allowLooseComments) {
          setComments(strict);
          return;
        }
        const strictIds = new Set(strict.map((item) => item.id));
        const loose = replies.filter(
          (msg) =>
            msg?.id &&
            !strictIds.has(msg.id) &&
            isLooseCommentReply(msg, messageId)
        );
        setComments(strict.concat(loose));

      } catch (err) {

        console.error("Load comments error:", err);

      } finally {

        setLoading(false);

      }

    };

    loadComments();

  }, [channel, client, messageId, allowLooseComments]);



  // Слушаем новые ответы в треде

  useEffect(() => {

    if (!channel) return;



    const handleNewMessage = (event) => {

      if (event.message?.parent_id === messageId) {

        if (!isCommentReply(event.message, messageId)) return;

        appendComment(event.message);

        // Прокручиваем вниз

        setTimeout(() => {

          listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });

        }, 50);

      }

    };



    channel.on("message.new", handleNewMessage);

    return () => channel.off("message.new", handleNewMessage);

  }, [channel, messageId, appendComment]);



  const handleSend = async (e) => {

    e?.preventDefault();

    const trimmed = newComment.trim();

    if (!trimmed || sending || !channel) return;



    setSending(true);

    try {

      // Отправляем как ответ к сообщению-опросу (тред)

      const response = await channel.sendMessage({

        text: trimmed,

        parent_id: messageId,

        custom_type: "poll_comment",

        poll_comment: true,

        poll_message_id: messageId,

        extraData: { poll_comment: true, poll_message_id: messageId },

        extra_data: { poll_comment: true, poll_message_id: messageId },

        attachments: [
          { type: "poll_comment", poll_message_id: messageId },
        ],

      });

      if (response?.message) {

        appendComment(response.message);

      }

      setNewComment("");

      inputRef.current?.focus();

    } catch (err) {

      console.error("Send comment error:", err);

    } finally {

      setSending(false);

    }

  };



  const handleBackdrop = (e) => {

    if (e.target === e.currentTarget) onClose();

  };



  const currentUserId = client?.user?.id || "";



  useEffect(() => {

    if (!client?.queryUsers || comments.length === 0) return;

    const ids = comments

      .map((comment) => comment.user?.id || comment.user_id)

      .filter(Boolean);

    const uniqueIds = Array.from(new Set(ids));

    const missing = uniqueIds.filter(

      (id) =>

        !client?.state?.users?.[id] &&

        !commentUserCache[id] &&

        !commentUserInFlight.current.has(id)

    );

    if (!missing.length) return;

    missing.forEach((id) => commentUserInFlight.current.add(id));



    client

      .queryUsers({ id: { $in: missing } })

      .then((response) => {

        const users = response?.users || [];

        setCommentUserCache((prev) => {

          const next = { ...prev };

          users.forEach((user) => {

            if (user?.id) next[user.id] = user;

          });

          return next;

        });

        missing.forEach((id) => commentUserInFlight.current.delete(id));

      })

      .catch(() => {

        missing.forEach((id) => commentUserInFlight.current.delete(id));

      });

  }, [client, comments, commentUserCache]);



  if (typeof document === "undefined") return null;

  const portalTarget =
    document.querySelector(".chat-main") || document.body;

  return createPortal(

    <div className="poll-modal-overlay poll-modal-overlay--comments" onClick={handleBackdrop}>

      <div className="poll-modal poll-modal-comments" onClick={(e) => e.stopPropagation()}>

        <div className="poll-modal-header">

          <h4>Комментарии ({comments.length || commentsCount})</h4>

          <button type="button" className="poll-modal-close" onClick={onClose}>

            <X size={18} />

          </button>

        </div>

        <div className="poll-comments-list" ref={listRef}>

          {loading ? (

            <div className="poll-comments-loading">Загрузка...</div>

          ) : comments.length === 0 ? (

            <div className="poll-comments-empty">Нет комментариев</div>

          ) : (

            comments.map((comment) => {

              const isMine = comment.user?.id === currentUserId;

              const cachedUser =

                commentUserCache[comment.user?.id || comment.user_id] ||

                client?.state?.users?.[comment.user?.id || comment.user_id];

              const authorName = displayName(

                comment.user ||

                  cachedUser || {

                    id: comment.user_id || "unknown",

                    name: comment.user_name || "Аноним",

                    first_name: comment.user?.first_name,

                    last_name: comment.user?.last_name,

                    username: comment.user?.username,

                  }

              );

              const time = comment.created_at

                ? new Date(comment.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

                : "";

              return (

                <div key={comment.id} className={`poll-comment ${isMine ? "poll-comment--mine" : ""}`}>

                  <div className="poll-comment-author">{authorName}</div>

                  <div className="poll-comment-text">{comment.text}</div>

                  <div className="poll-comment-time">{time}</div>

                </div>

              );

            })

          )}

        </div>

        <form onSubmit={handleSend} className="poll-comments-input-row">

          <input

            ref={inputRef}

            type="text"

            value={newComment}

            onChange={(e) => setNewComment(e.target.value)}

            placeholder="Написать комментарий..."

            className="poll-comments-input"

          />

          <button

            type="submit"

            className="poll-comments-send"

            disabled={!newComment.trim() || sending}

          >

            <Send size={18} />

          </button>

        </form>

      </div>

    </div>,

    portalTarget

  );

};



// ========== КАРТОЧКА ОПРОСА ==========
const PollMessageCard = ({ poll: propPoll }) => {
  const { message } = useMessageContext("PollMessageCard");
  const { client } = useChatContext("PollMessageCard");
  const { channel } = useChannelStateContext("PollMessageCard");

  const isMine = Boolean(
    message?.user?.id && client?.user?.id && message.user.id === client.user.id
  );

  const [voting, setVoting] = useState(false);
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [commentsReplies, setCommentsReplies] = useState([]);
  const [suggestionsReplies, setSuggestionsReplies] = useState([]);
  const [hoveredOptionId, setHoveredOptionId] = useState(null);
  const [reactionUsersByType, setReactionUsersByType] = useState({});
  const [reactionUsersLoading, setReactionUsersLoading] = useState({});
  const reactionUsersInFlightRef = useRef(new Set());
  const reactionUsersCountRef = useRef({});
  const commentsFetchRef = useRef({ id: null, ts: 0, inFlight: false });
  const suggestionsFetchRef = useRef({ id: null, ts: 0, inFlight: false });

  const messageId = message?.id || "";
  const pollReactionPrefix = POLL_REACTION_PREFIX;

  const fallbackPoll = message?.poll_data;
  const streamPoll = propPoll || message?.poll;
  const isFallbackPoll = message?.custom_type === "poll" && Boolean(fallbackPoll);
  const isStreamPoll = Boolean(streamPoll?.id) && !isFallbackPoll;

  const pollData = useMemo(() => {
    if (isFallbackPoll && fallbackPoll) {
      const rawOptions = Array.isArray(fallbackPoll.options) ? fallbackPoll.options : [];
      const normalizedOptions = rawOptions
        .map((opt, idx) => {
          const rawId = opt.option_id || opt.id || `opt_${idx}`;
          return {
            id: normalizeOptionId(rawId),
            text: opt.text || opt.name || "",
          };
        })
        .filter((opt) => opt.id && opt.text);
      if (!normalizedOptions.length) return null;
      const question = fallbackPoll.question || fallbackPoll.name || "";
      if (!question) return null;
      return {
        id: fallbackPoll.id || message?.id || "unknown",
        question,
        options: normalizedOptions,
        isMultiple: fallbackPoll.multiple_answers ?? false,
        maxAnswers:
          fallbackPoll.max_answers ??
          (fallbackPoll.multiple_answers ? normalizedOptions.length : 1),
        isAnonymous: fallbackPoll.anonymous ?? false,
        allowSuggestions: fallbackPoll.allow_suggestions ?? false,
        allowComments: fallbackPoll.allow_comments ?? false,
      };
    }
    if (isStreamPoll && streamPoll) {
      const rawOptions = Array.isArray(streamPoll.options) ? streamPoll.options : [];
      const normalizedOptions = rawOptions
        .map((opt, idx) => {
          const rawId = opt.option_id || opt.id || `opt_${idx}`;
          return {
            id: normalizeOptionId(rawId),
            text: opt.text || opt.name || "",
          };
        })
        .filter((opt) => opt.id && opt.text);
      if (!normalizedOptions.length) return null;
      const question = streamPoll.name || streamPoll.question || "";
      if (!question) return null;
      return {
        id: streamPoll.id,
        question,
        options: normalizedOptions,
        isMultiple: (streamPoll.max_votes_allowed ?? 1) > 1,
        maxAnswers: streamPoll.max_votes_allowed ?? 1,
        isAnonymous: streamPoll.voting_visibility === "anonymous",
        allowSuggestions: streamPoll.allow_user_suggested_options ?? false,
        allowComments: streamPoll.allow_answers ?? false,
      };
    }
    return null;
  }, [isFallbackPoll, fallbackPoll, isStreamPoll, streamPoll, message?.id]);

  // Загружаем количество комментариев при монтировании
  useEffect(() => {
    if (!channel || !messageId || !pollData?.allowComments) {
      setCommentsReplies([]);
      return;
    }

    const now = Date.now();
    const cache = commentsFetchRef.current;
    if (cache.inFlight && cache.id === messageId) return;
    if (cache.id === messageId && now - cache.ts < 5000) return;

    cache.id = messageId;
    cache.ts = now;
    cache.inFlight = true;

    let isActive = true;
    const threadReplies = getThreadRepliesFromState(channel, messageId);
    fetchThreadReplies({ channel, client, messageId })
      .then((replies) => {
        if (!isActive) return;
        const combined = replies.concat(
          threadReplies.filter((reply) => reply?.id && !replies.some((item) => item.id === reply.id))
        );
        const strict = combined.filter((reply) => isCommentReply(reply, messageId));
        if (pollData?.allowSuggestions) {
          setCommentsReplies(strict);
          return;
        }
        const strictIds = new Set(strict.map((item) => item.id));
        const loose = combined.filter(
          (reply) =>
            reply?.id &&
            !strictIds.has(reply.id) &&
            isLooseCommentReply(reply, messageId)
        );
        setCommentsReplies(strict.concat(loose));
      })
      .catch(() => {
        if (!isActive) return;
        setCommentsReplies([]);
      })
      .finally(() => {
        commentsFetchRef.current.inFlight = false;
      });

    return () => {
      isActive = false;
    };
  }, [channel, client, messageId, pollData?.allowComments, pollData?.allowSuggestions]);

  // Слушаем новые комментарии
  useEffect(() => {
    if (!channel || !message?.id || !pollData?.allowComments) return;

    const handleNewMessage = (event) => {
      if (event.message?.parent_id !== message.id) return;
      if (!isCommentReply(event.message, message.id)) return;
      setCommentsReplies((prev) => {
        if (prev.some((item) => item.id === event.message.id)) return prev;
        return [...prev, event.message];
      });
    };

    channel.on("message.new", handleNewMessage);
    return () => channel.off("message.new", handleNewMessage);
  }, [channel, message?.id, pollData?.allowComments]);

  const appendSuggestionReply = useCallback(
    (reply) => {
      if (!reply?.id || !isSuggestionReply(reply, message?.id)) return;
      setSuggestionsReplies((prev) => {
        if (prev.some((item) => item.id === reply.id)) return prev;
        return [...prev, reply];
      });
    },
    [message?.id]
  );

  const handleAddOption = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed || !channel?.sendMessage || !message?.id) return false;

      const normalized = normalizeOptionText(trimmed);
      if (!normalized) return false;

      const baseOptions = pollData?.options || EMPTY_ARRAY;
      const duplicateInBase = baseOptions.some((opt) =>
        normalizeOptionText(opt?.text) === normalized
      );
      const duplicateInSuggestions = suggestionsReplies.some((reply) =>
        normalizeOptionText(getSuggestionText(reply)) === normalized
      );
      if (duplicateInBase || duplicateInSuggestions) {
        toast.error("\u042d\u0442\u043e\u0442 \u0432\u0430\u0440\u0438\u0430\u043d\u0442 \u0443\u0436\u0435 \u0435\u0441\u0442\u044c.");
        return false;
      }

      try {
        const optionId = createSuggestionOptionId();
        const response = await channel.sendMessage({
          text: trimmed,
          parent_id: message.id,
          custom_type: "poll_suggestion",
          show_in_channel: true,
          poll_suggestion: true,
          poll_message_id: message.id,
          poll_option_id: optionId,
          extraData: {
            poll_suggestion: true,
            poll_message_id: message.id,
            poll_option_id: optionId,
          },
          extra_data: {
            poll_suggestion: true,
            poll_message_id: message.id,
            poll_option_id: optionId,
          },
          attachments: [
            {
              type: "poll_suggestion",
              poll_message_id: message.id,
              poll_option_id: optionId,
            },
          ],
        });
        if (channel?.sendMessage) {
          try {
            await channel.sendMessage({
              text: trimmed,
              custom_type: "poll_suggestion_shadow",
              show_in_channel: true,
              poll_suggestion: true,
              poll_shadow: true,
              poll_message_id: message.id,
              poll_option_id: optionId,
              extraData: {
                poll_suggestion: true,
                poll_shadow: true,
                poll_message_id: message.id,
                poll_option_id: optionId,
              },
              extra_data: {
                poll_suggestion: true,
                poll_shadow: true,
                poll_message_id: message.id,
                poll_option_id: optionId,
              },
            });
          } catch {
            // Shadow-сообщение — best-effort; ошибки игнорируем.
          }
        }
        if (response?.message) {
          appendSuggestionReply(response.message);
        }
        return true;
      } catch {
        toast.error("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435.");
        return false;
      }
    },
    [channel, message?.id, appendSuggestionReply, pollData, suggestionsReplies]
  );

  useEffect(() => {
    if (!channel || !messageId) {
      setSuggestionsReplies([]);
      return;
    }

    const inChannel = Array.isArray(channel?.state?.messages)
      ? channel.state.messages
      : [];
    const threadReplies = getThreadRepliesFromState(channel, messageId);
    if (threadReplies.length) {
      setSuggestionsReplies((prev) => {
        const prevIds = new Set(prev.map((item) => item.id));
        const merged = prev.concat(
          threadReplies.filter((item) => item?.id && !prevIds.has(item.id))
        );
        return merged.length === prev.length ? prev : merged;
      });
    }
    if (inChannel.length) {
      const inChannelSuggestions = inChannel.filter((reply) =>
        pollData?.allowSuggestions
          ? isSuggestionReply(reply, messageId) ||
            isLooseSuggestionReply(reply, messageId)
          : isSuggestionReply(reply, messageId)
      );
      const shadowSuggestions = inChannel.filter((msg) => {
        if (!isShadowSuggestion(msg)) return false;
        const extra = msg.extraData || msg.extra_data || EMPTY_OBJECT;
        const pollMessageIdValue =
          msg.poll_message_id ?? extra.poll_message_id;
        if (!pollMessageIdValue) return false;
        return String(pollMessageIdValue) === String(messageId);
      });
      const candidates = inChannelSuggestions.concat(shadowSuggestions);
      if (candidates.length) {
        setSuggestionsReplies((prev) => {
          const prevIds = new Set(prev.map((item) => item.id));
          const merged = prev.concat(
            candidates.filter((item) => item?.id && !prevIds.has(item.id))
          );
          return merged.length === prev.length ? prev : merged;
        });
      }
    }

    const now = Date.now();
    const cache = suggestionsFetchRef.current;
    if (cache.inFlight && cache.id === messageId) return;
    if (cache.id === messageId && now - cache.ts < 5000) return;

    cache.id = messageId;
    cache.ts = now;
    cache.inFlight = true;

    let isActive = true;
    fetchThreadReplies({ channel, client, messageId })
      .then((replies) => {
        if (!isActive) return;
        const suggestions = replies.filter((reply) =>
          isSuggestionReply(reply, messageId)
        );
        const inChannel = Array.isArray(channel?.state?.messages)
          ? channel.state.messages
          : [];
        const threadReplies = getThreadRepliesFromState(channel, messageId);
        const inChannelSuggestions = inChannel.filter((reply) =>
          pollData?.allowSuggestions
            ? isSuggestionReply(reply, messageId) ||
              isLooseSuggestionReply(reply, messageId)
            : isSuggestionReply(reply, messageId)
        );
        const shadowSuggestions = inChannel.filter((msg) => {
          if (!isShadowSuggestion(msg)) return false;
          const extra = msg.extraData || msg.extra_data || EMPTY_OBJECT;
          const pollMessageIdValue =
            msg.poll_message_id ?? extra.poll_message_id;
          if (!pollMessageIdValue) return false;
          return String(pollMessageIdValue) === String(messageId);
        });
        if (pollData?.allowSuggestions) {
          const fallback = replies.filter((reply) =>
            isLooseSuggestionReply(reply, messageId)
          );
          const seen = new Set([
            ...suggestions.map((item) => item.id),
            ...inChannelSuggestions.map((item) => item.id),
            ...shadowSuggestions.map((item) => item.id),
            ...threadReplies.map((item) => item.id),
          ]);
          const merged = suggestions
            .concat(
              inChannelSuggestions.filter((item) => item?.id && !seen.has(item.id))
            )
            .concat(
              shadowSuggestions.filter((item) => item?.id && !seen.has(item.id))
            )
            .concat(
              threadReplies.filter((item) => item?.id && !seen.has(item.id))
            )
            .concat(
              fallback.filter((item) => item?.id && !seen.has(item.id))
            );
          setSuggestionsReplies(merged);
        } else {
          const seen = new Set([
            ...suggestions.map((item) => item.id),
            ...shadowSuggestions.map((item) => item.id),
            ...threadReplies.map((item) => item.id),
          ]);
          const merged = suggestions
            .concat(
              inChannelSuggestions.filter((item) => item?.id && !seen.has(item.id))
            )
            .concat(
              shadowSuggestions.filter((item) => item?.id && !seen.has(item.id))
            )
            .concat(
              threadReplies.filter((item) => item?.id && !seen.has(item.id))
            );
          setSuggestionsReplies(merged);
        }
      })
      .catch((err) => {
        console.error("Load suggestions error:", err);
      })
      .finally(() => {
        suggestionsFetchRef.current.inFlight = false;
      });

    return () => {
      isActive = false;
    };
  }, [
    channel,
    client,
    messageId,
    pollData?.allowSuggestions,
    channel?.state?.messages?.length,
  ]);

  useEffect(() => {
    if (!channel || !message?.id) return;

    const handleNewMessage = (event) => {
      if (event.message?.parent_id !== message.id) return;
      if (!isSuggestionReply(event.message, message.id)) return;
      appendSuggestionReply(event.message);
    };

    channel.on("message.new", handleNewMessage);
    return () => channel.off("message.new", handleNewMessage);
  }, [channel, message?.id, appendSuggestionReply]);

  const pollId = pollData?.id || null;
  const question = pollData?.question || "";
  const isMultiple = pollData?.isMultiple ?? false;
  const isAnonymous = pollData?.isAnonymous ?? false;
  const allowSuggestions = pollData?.allowSuggestions ?? false;
  const allowComments = pollData?.allowComments ?? false;
  const commentsCount = useMemo(() => commentsReplies.length, [commentsReplies]);

  const suggestionOptions = useMemo(() => {
    if (!suggestionsReplies.length) return EMPTY_ARRAY;
    const baseTextSet = new Set();
    (pollData?.options || EMPTY_ARRAY).forEach((opt) => {
      const normalized = normalizeOptionText(opt?.text);
      if (normalized) baseTextSet.add(normalized);
    });
    const unique = new Map();
    suggestionsReplies.forEach((reply) => {
      const text = getSuggestionText(reply);
      const normalized = normalizeOptionText(text);
      if (!normalized) return;
      if (baseTextSet.has(normalized)) return;
      if (unique.has(normalized)) return;
      const sugId = getSuggestionOptionId(reply);
      if (!sugId) return;
      const user =
        reply?.user || client?.state?.users?.[reply?.user_id] || null;
      unique.set(normalized, {
        id: sugId,
        text,
        suggested: true,
        suggestedByName: user ? displayName(user) : "",
      });
    });
    return Array.from(unique.values());
  }, [suggestionsReplies, client, pollData]);

  const baseOptions = pollData?.options || EMPTY_ARRAY;
  const optionsList = useMemo(
    () => [...baseOptions, ...suggestionOptions],
    [baseOptions, suggestionOptions]
  );

  const reactionCounts = message?.reaction_counts || EMPTY_OBJECT;
  const reactionGroups = message?.reaction_groups || EMPTY_OBJECT;

  const getReactionCount = useCallback(
    (reactionType) => {
      if (!reactionType) return 0;
      const direct = reactionCounts[reactionType];
      if (typeof direct === "number") return direct;
      const group = reactionGroups[reactionType];
      if (group && typeof group.count === "number") return group.count;
      return 0;
    },
    [reactionCounts, reactionGroups]
  );

  const ownPollReactions = useMemo(() => {
    return (message?.own_reactions || []).filter((reaction) =>
      String(reaction?.type || "").startsWith(pollReactionPrefix)
    );
  }, [message?.own_reactions, pollReactionPrefix]);

  const ownSelectedOptionIds = useMemo(() => {
    const ids = new Set();
    ownPollReactions.forEach((reaction) => {
      const type = String(reaction?.type || "");
      if (!type.startsWith(pollReactionPrefix)) return;
      const optionId = type.slice(pollReactionPrefix.length);
      if (optionId) ids.add(optionId);
    });
    return ids;
  }, [ownPollReactions, pollReactionPrefix]);

  const totalVotes = useMemo(() => {
    return optionsList.reduce((sum, opt) => {
      if (!opt?.id) return sum;
      return sum + getReactionCount(`${pollReactionPrefix}${opt.id}`);
    }, 0);
  }, [optionsList, getReactionCount, pollReactionPrefix]);

  const optionsData = useMemo(() => {
    return optionsList.map((opt) => {
      const reactionType = `${pollReactionPrefix}${opt.id}`;
      const count = getReactionCount(reactionType);
      const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
      const isSelected = ownSelectedOptionIds.has(opt.id);
      return {
        id: opt.id,
        text: opt.text,
        suggested: Boolean(opt.suggested),
        suggestedByName: opt.suggestedByName,
        isPending: Boolean(opt.suggested),
        count,
        pct,
        isSelected,
      };
    });
  }, [optionsList, getReactionCount, totalVotes, ownSelectedOptionIds, pollReactionPrefix]);

  const hasVoted = ownSelectedOptionIds.size > 0;
  const showResults = hasVoted || totalVotes > 0;

  const sendPollReaction = useCallback(
    async (reactionType) => {
      if (!messageId || !reactionType) return;
      if (channel?.sendReaction) {
        await channel.sendReaction(messageId, { type: reactionType });
        return;
      }
      if (client?.sendReaction) {
        await client.sendReaction(messageId, { type: reactionType });
        return;
      }
      throw new Error("Reaction API unavailable");
    },
    [channel, client, messageId]
  );

  const deletePollReaction = useCallback(
    async (reactionType) => {
      if (!messageId || !reactionType) return;
      if (channel?.deleteReaction) {
        await channel.deleteReaction(messageId, reactionType);
        return;
      }
      if (client?.deleteReaction) {
        await client.deleteReaction(messageId, reactionType);
        return;
      }
      throw new Error("Reaction API unavailable");
    },
    [channel, client, messageId]
  );

  const handleOptionClick = useCallback(
    async (optionId) => {
      if (!optionId || voting || !messageId) return;

      const reactionType = `${pollReactionPrefix}${optionId}`;
      const isSelected = ownSelectedOptionIds.has(optionId);
      const existingReactionTypes = Array.from(
        new Set(
          ownPollReactions
            .map((reaction) => reaction?.type)
            .filter((type) => String(type).startsWith(pollReactionPrefix))
        )
      );

      setVoting(true);
      try {
        if (isMultiple) {
          if (isSelected) {
            await deletePollReaction(reactionType);
          } else {
            await sendPollReaction(reactionType);
          }
        } else {
          if (isSelected) {
            await deletePollReaction(reactionType);
          } else {
            for (const type of existingReactionTypes) {
              if (type && type !== reactionType) {
                await deletePollReaction(type);
              }
            }
            await sendPollReaction(reactionType);
          }
        }
      } catch (err) {
        console.error("Vote error:", err);
        toast.error("Не удалось обновить голосование.");
      } finally {
        setVoting(false);
      }
    },
    [
      voting,
      messageId,
      isMultiple,
      ownSelectedOptionIds,
      ownPollReactions,
      sendPollReaction,
      deletePollReaction,
      pollReactionPrefix,
    ]
  );

  const fetchReactionUsers = useCallback(
    async (reactionType, expectedCount) => {
      if (!reactionType || !messageId) return;
      if (reactionUsersInFlightRef.current.has(reactionType)) return;
      if (!client?.queryReactions && !channel?.getReactions) return;

      reactionUsersInFlightRef.current.add(reactionType);
      setReactionUsersLoading((prev) => ({ ...prev, [reactionType]: true }));

      try {
        let all = [];
        if (client?.queryReactions) {
          let next;
          do {
            const response = await client.queryReactions(
              messageId,
              { type: reactionType },
              { created_at: -1 },
              { limit: 100, next }
            );
            all = all.concat(response?.reactions || []);
            next = response?.next;
          } while (next);
        } else if (channel?.getReactions) {
          let offset = 0;
          const limit = 100;
          while (true) {
            const response = await channel.getReactions(messageId, { limit, offset });
            const list = response?.reactions || [];
            const filtered = list.filter((reaction) => reaction?.type === reactionType);
            all = all.concat(filtered);
            if (list.length < limit) break;
            offset += limit;
          }
        }
        setReactionUsersByType((prev) => ({ ...prev, [reactionType]: all }));
        reactionUsersCountRef.current[reactionType] =
          typeof expectedCount === "number" ? expectedCount : all.length;
      } catch (err) {
        console.error("Load reaction users error:", err);
      } finally {
        setReactionUsersLoading((prev) => ({ ...prev, [reactionType]: false }));
        reactionUsersInFlightRef.current.delete(reactionType);
      }
    },
    [client, channel, messageId]
  );

  useEffect(() => {
    if (!hoveredOptionId || isAnonymous) return;
    const reactionType = `${pollReactionPrefix}${hoveredOptionId}`;
    const count = getReactionCount(reactionType);
    if (!count) return;
    const cached = reactionUsersByType[reactionType];
    const lastCount = reactionUsersCountRef.current[reactionType];
    if (cached && lastCount === count) return;
    fetchReactionUsers(reactionType, count);
  }, [
    hoveredOptionId,
    isAnonymous,
    getReactionCount,
    reactionUsersByType,
    fetchReactionUsers,
    pollReactionPrefix,
  ]);

  const resolveReactionUserName = useCallback(
    (reaction) => {
      if (!reaction) return "";
      const user =
        reaction.user ||
        client?.state?.users?.[reaction.user_id] ||
        (reaction.user_id ? { id: reaction.user_id } : null);
      return user ? displayName(user) : "";
    },
    [client]
  );

  const canOpenSuggestions = Boolean(pollData && allowSuggestions);
  const canOpenComments = Boolean(pollData && allowComments);

  // Текст количества голосов
  const getVoteCountText = (count) => {
    if (count === 0) return "Нет голосов";
    if (count === 1) return "1 голос";
    if (count < 5) return `${count} голоса`;
    return `${count} голосов`;
  };

  useEffect(() => {
    if (!pollData) {
      setShowSuggestionsModal(false);
      setShowCommentsModal(false);
    }
  }, [pollData]);

  if (!pollData || optionsList.length === 0 || !question) return null;

  return (
    <div
      className={`poll-card ${isMine ? "poll-card--mine" : "poll-card--theirs"}`}
      data-poll-id={pollId}
    >
      {/* Заголовок с бейджами */}
      <div className="poll-card-header">
        <span className="poll-card-title">Опрос</span>
        {isAnonymous && <span className="poll-card-badge">Анонимный</span>}
        {isMultiple && <span className="poll-card-badge">Несколько</span>}
      </div>

      {/* Вопрос */}
      <div className="poll-card-question">{question}</div>

      {/* Варианты */}
      <div className="poll-card-options">
        {optionsData.map((opt) => {
          const optionClasses = [
            "poll-card-option",
            opt.isSelected ? "poll-card-option--selected" : "",
            hasVoted ? "poll-card-option--revotable" : "",
          ]
            .filter(Boolean)
            .join(" ");

          const indicatorClass = isMultiple
            ? `poll-card-checkbox ${opt.isSelected ? "poll-card-checkbox--checked" : ""}`
            : `poll-card-radio ${opt.isSelected ? "poll-card-radio--checked" : ""}`;

          const reactionType = `${pollReactionPrefix}${opt.id}`;
          const votersForOption = reactionUsersByType?.[reactionType] || [];
          const showVotesPopover = hoveredOptionId === opt.id && opt.count > 0;
          const isLoadingVoters = reactionUsersLoading?.[reactionType];
          const voterNames = votersForOption
            .map((vote) => resolveReactionUserName(vote))
            .filter((name) => name && name !== "Unknown");

          return (
            <div
              key={opt.id}
              className={optionClasses}
              onClick={() => handleOptionClick(opt.id)}
              onMouseEnter={() => setHoveredOptionId(opt.id)}
              onMouseLeave={() => setHoveredOptionId(null)}
              onFocus={() => setHoveredOptionId(opt.id)}
              onBlur={() => setHoveredOptionId(null)}
              tabIndex={0}
            >
              {/* Полоса прогресса — всегда видна после голосования */}
              {showResults && (
                <div
                  className="poll-card-option-bar"
                  style={{ width: `${opt.pct}%` }}
                />
              )}

              <div className="poll-card-option-content">
                <span className="poll-card-option-indicator">
                  <span className={indicatorClass} />
                </span>
                <span className="poll-card-option-text">
                  {opt.text}
                  {opt.suggested && (
                    <span className="poll-card-option-suggested"> (предложено)</span>
                  )}</span>
              </div>

              {showVotesPopover && (
                <div className="poll-votes-popover">
                  <div className="poll-votes-title">Голоса</div>
                  <div className="poll-votes-row">
                    <span className="poll-votes-option">{opt.text}</span>
                    <span className="poll-votes-users">
                      {isAnonymous ? (
                        <>
                          Анонимно • {opt.count}
                        </>
                      ) : isLoadingVoters ? (
                        "Загрузка..."
                      ) : voterNames.length > 0 ? (
                        voterNames.join(", ")
                      ) : opt.count > 0 ? (
                        `Голосов: ${opt.count}`
                      ) : (
                        "Пока нет голосов"
                      )}
                    </span>
                  </div>
                </div>
              )}

              {showResults && (
                <div className="poll-card-option-result">
                  <span className="poll-card-option-pct">{opt.pct}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Кнопки действий: Предложения и Комментарии */}
      {(allowSuggestions || allowComments) && (
        <div className="poll-card-actions">
          {allowSuggestions && (
            <button
              type="button"
              className="poll-card-action-btn"
              onClick={() => {
                if (canOpenSuggestions) setShowSuggestionsModal(true);
              }}
              disabled={!canOpenSuggestions}
            >
              <Plus size={14} />
              <span>Предложения</span>
            </button>
          )}
          {allowComments && (
            <button
              type="button"
              className="poll-card-action-btn"
              onClick={() => {
                if (canOpenComments) setShowCommentsModal(true);
              }}
              disabled={!canOpenComments}
            >
              <MessageSquare size={14} />
              <span>
                Комментарии
              </span>
            </button>
          )}
        </div>
      )}

      {/* Всего голосов */}
      <div className="poll-card-total">
        {getVoteCountText(totalVotes)}
        {hasVoted && <span className="poll-card-voted-mark"> • Вы проголосовали</span>}
        {hasVoted && <span className="poll-card-revote-hint"> (клик для переголосования)</span>}
      </div>

      {/* Модалка предложений */}
      {showSuggestionsModal && canOpenSuggestions && (
        <SuggestionsModal
          pollData={pollData}
          onClose={() => setShowSuggestionsModal(false)}
          onAddOption={handleAddOption}
        />
      )}

      {/* Модалка комментариев */}
      {showCommentsModal && canOpenComments && (
        <CommentsModal
          messageId={message?.id}
          onClose={() => setShowCommentsModal(false)}
          commentsCount={commentsCount}
          allowLooseComments={!allowSuggestions}
        />
      )}
    </div>
  );
};

export default PollMessageCard;

