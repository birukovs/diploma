import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useMessageContext, useChatContext, useChannelStateContext } from "stream-chat-react";
import { MessageSquare, Plus, X, Send } from "lucide-react";
import toast from "react-hot-toast";
import "../styles/polls.css";

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

const buildSuggestionOptions = (suggestions = []) =>
  suggestions
    .map((item, index) => {
      if (!item) return null;
      if (typeof item === "string") {
        return {
          id: `suggest_${index}`,
          text: item.trim(),
          suggested: true,
          suggestedBy: null,
          status: "pending",
        };
      }
      const text = (item.text || item.name || "").trim();
      if (!text) return null;
      return {
        id: item.id || item.option_id || `suggest_${Date.now()}_${index}`,
        text,
        suggested: true,
        suggestedBy: item.userId || item.suggestedBy || item.user_id || null,
        status: item.status || "pending",
        createdAt: item.createdAt || item.created_at || null,
      };
    })
    .filter(Boolean);

const mergeOptionsById = (baseOptions = [], extraOptions = []) => {
  const map = new Map();
  baseOptions.forEach((opt) => {
    if (opt?.id) map.set(opt.id, opt);
  });
  extraOptions.forEach((opt) => {
    if (!opt?.id || map.has(opt.id)) return;
    map.set(opt.id, opt);
  });
  return Array.from(map.values());
};

const areSetsEqual = (left = new Set(), right = new Set()) => {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
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

const normalizeVoteUser = (vote) => {
  if (!vote) return null;
  // Extract userId from vote object - ONLY from actual vote data
  const userId =
    vote.user?.id ||
    vote.user_id ||
    vote.userId ||
    null;
  // If no userId in vote, skip this vote entirely
  if (!userId) return null;

  // Build name from vote's user data ONLY - never invent names
  let name = null;
  if (vote.user) {
    name = displayName(vote.user);
  } else if (vote.user_name || vote.name) {
    name = vote.user_name || vote.name;
  } else if (vote.username) {
    name = vote.username;
  }
  // If no name found, use shortened ID (do NOT use "Unknown" or fallback)
  if (!name || name === "Unknown") {
    name = String(userId).slice(0, 8);
  }

  return {
    userId,
    name,
    username: vote.username || vote.user?.username || null,
    createdAt: vote.created_at || vote.createdAt || null,
  };
};

const mergeVoteMaps = (primary = {}, secondary = {}, optionIds = []) => {
  const result = {};
  optionIds.forEach((optionId) => {
    const primaryVotes = primary[optionId] || [];
    const secondaryVotes = secondary[optionId] || [];
    if (primaryVotes.length) {
      result[optionId] = primaryVotes;
      return;
    }
    result[optionId] = secondaryVotes;
  });
  return result;
};

const computeSelectedFromPoll = ({
  isStreamPoll,
  ownVotes,
  voters,
  currentUserId,
}) => {
  if (isStreamPoll) {
    return (ownVotes || [])
      .map((vote) => vote?.option_id)
      .filter(Boolean);
  }
  const selected = [];
  const source = voters || EMPTY_OBJECT;
  Object.entries(source).forEach(([optId, userIds]) => {
    if (!optId || !Array.isArray(userIds)) return;
    if (userIds.includes(currentUserId)) selected.push(optId);
  });
  return selected;
};

// STRICT filter: only poll_suggestion === true AND poll_message_id match
const isSuggestionReply = (msg, pollMessageId) => {
  if (!msg || !pollMessageId) return false;
  if (msg.parent_id !== pollMessageId) return false;
  const extra = msg.extraData || msg.extra_data || EMPTY_OBJECT;
  const hasSuggestionFlag =
    msg.poll_suggestion === true ||
    extra.poll_suggestion === true;
  if (!hasSuggestionFlag) return false;
  const pollMessageIdValue = msg.poll_message_id ?? extra.poll_message_id;
  if (
    pollMessageIdValue &&
    String(pollMessageIdValue) !== String(pollMessageId)
  ) {
    return false;
  }
  if (msg.poll_comment === true || extra.poll_comment === true) return false;
  if (msg.poll_sync_ping === true || extra.poll_sync_ping === true) return false;
  return true;
};

const getSuggestionText = (reply) => {
  const primary = String(reply?.text ?? reply?.message?.text ?? "").trim();
  if (primary) return primary;
  const fallback = String(
    reply?.extraData?.suggestion_text ??
      reply?.extra_data?.suggestion_text ??
      reply?.extraData?.suggestion ??
      reply?.extra_data?.suggestion ??
      ""
  ).trim();
  if (!fallback || /^\d+$/.test(fallback)) return "";
  return fallback;
};

const extractSuggestionText = (reply) => getSuggestionText(reply);

const normalizeSuggestionText = (text) => String(text || "").trim().toLowerCase();

// STRICT filter: only poll_comment === true, exclude suggestions and sync pings
const isCommentReply = (msg, pollMessageId) => {
  if (!msg || msg.parent_id !== pollMessageId) return false;
  // Must have explicit poll_comment flag
  const hasCommentFlag =
    msg.poll_comment === true ||
    msg.extraData?.poll_comment === true;
  if (!hasCommentFlag) return false;
  // Must NOT be a suggestion
  if (msg.poll_suggestion === true || msg.extraData?.poll_suggestion === true) return false;
  // Must NOT be a sync ping
  if (msg.poll_sync_ping === true || msg.extraData?.poll_sync_ping === true) return false;
  return true;
};

// Check if message is a sync ping (hidden from UI)
const isSyncPing = (msg) => {
  if (!msg) return false;
  return msg.poll_sync_ping === true || msg.extraData?.poll_sync_ping === true;
};

// ========== SUGGESTIONS MODAL ==========
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
      await onAddOption(trimmed);
      onClose();
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

  return (
    <div className="poll-modal-overlay" onClick={handleBackdrop}>
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
    </div>
  );
};

// ========== COMMENTS MODAL ==========
const CommentsModal = ({ messageId, onClose, commentsCount }) => {
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

  // Load thread replies on mount
  useEffect(() => {
    const loadComments = async () => {
      if (!channel || !messageId) {
        setLoading(false);
        return;
      }
      try {
        // Load thread replies for this message
        const response = await channel.getReplies(messageId, { limit: 100 });
        const nextComments = (response.messages || []).filter((msg) =>
          isCommentReply(msg, messageId)
        );
        setComments(nextComments);
      } catch (err) {
        console.error("Load comments error:", err);
      } finally {
        setLoading(false);
      }
    };
    loadComments();
  }, [channel, messageId]);

  // Listen for new replies in thread
  useEffect(() => {
    if (!channel) return;

    const handleNewMessage = (event) => {
      if (event.message?.parent_id === messageId) {
        if (!isCommentReply(event.message, messageId)) return;
        appendComment(event.message);
        // Scroll to bottom
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
      // Send as reply to poll message (thread)
      const response = await channel.sendMessage({
        text: trimmed,
        parent_id: messageId,
        extraData: { poll_comment: true, poll_message_id: messageId },
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
    document.body
  );
};

// ========== POLL MESSAGE CARD ==========
const PollMessageCard = ({ poll: propPoll }) => {
  const { message } = useMessageContext("PollMessageCard");
  const { client } = useChatContext("PollMessageCard");
  const { channel } = useChannelStateContext("PollMessageCard");

  const [selectedOptions, setSelectedOptions] = useState(new Set());
  const [serverSelectedOptions, setServerSelectedOptions] = useState(new Set());
  const [voting, setVoting] = useState(false);
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [commentsReplies, setCommentsReplies] = useState([]);
  const [streamPollState, setStreamPollState] = useState(propPoll || message?.poll);
  const [optimisticSelection, setOptimisticSelection] = useState(null);
  const [hoveredOptionId, setHoveredOptionId] = useState(null);
  const [fallbackPollState, setFallbackPollState] = useState(() => message?.poll_data || null);
  const [suggestionsReplies, setSuggestionsReplies] = useState([]);
  const suggestionMetaRef = useRef(new Map());
  const suggestionOrderRef = useRef(0);
  const commentsFetchRef = useRef({ id: null, ts: 0, inFlight: false });
  const suggestionsFetchRef = useRef({ id: null, ts: 0, inFlight: false });
  const messageId = message?.id || "";
  const [userCache, setUserCache] = useState({});
  const inFlightUserIdsRef = useRef(new Set());

  // Get poll data - prefer poll_data (our custom format) over Stream SDK poll
  const fallbackPoll = message?.poll_data;
  const streamPoll = propPoll || message?.poll;
  const isFallbackPoll = message?.custom_type === "poll" && Boolean(fallbackPoll);
  const isStreamPoll = Boolean(streamPoll?.id) && !isFallbackPoll;
  const streamPollId = streamPollState?.id || streamPoll?.id;
  const allowSuggestionsFlag = isFallbackPoll
    ? fallbackPoll?.allow_suggestions ?? false
    : streamPoll?.allow_user_suggested_options ?? false;
  const canCreateSuggestionOption = Boolean(
    isStreamPoll && (client?.createPollOption || client?.addPollOption || client?.suggestPollOption)
  );
  const shouldUseThreadSuggestions = Boolean(channel && message?.id);

  // Current user ID
  const currentUserId = client?.user?.id || client?.userID || "";
  const isPollAuthor = message?.user?.id && message.user.id === currentUserId;
  const isModerator = ["admin", "moderator"].includes(client?.user?.role || "");
  const canPromoteSuggestion = Boolean(canCreateSuggestionOption && (isPollAuthor || isModerator));

  useEffect(() => {
    if (isStreamPoll && streamPoll) {
      setStreamPollState(streamPoll);
    }
  }, [
    isStreamPoll,
    streamPoll,
    streamPoll?.id,
    streamPoll?.updated_at,
    streamPoll?.vote_count,
    streamPoll?.vote_counts_by_option,
  ]);

  useEffect(() => {
    if (isFallbackPoll) {
      setFallbackPollState(fallbackPoll || null);
    }
  }, [isFallbackPoll, fallbackPoll]);


  const pollSuggestions = useMemo(() => {
    if (!allowSuggestionsFlag) return [];
    if (isStreamPoll) return [];
    if (shouldUseThreadSuggestions) return [];
    const rawSuggestions = [];
    if (Array.isArray(message?.poll_suggestions)) {
      rawSuggestions.push(...message.poll_suggestions);
    }
    if (Array.isArray(message?.extraData?.poll_suggestions)) {
      rawSuggestions.push(...message.extraData.poll_suggestions);
    }
    if (Array.isArray(fallbackPoll?.poll_suggestions)) {
      rawSuggestions.push(...fallbackPoll.poll_suggestions);
    }
    return buildSuggestionOptions(rawSuggestions);
  }, [
    allowSuggestionsFlag,
    isStreamPoll,
    shouldUseThreadSuggestions,
    message?.poll_suggestions,
    message?.extraData?.poll_suggestions,
    fallbackPoll?.poll_suggestions,
  ]);

  // Normalize poll data to common format
  const pollData = useMemo(() => {
    if (isFallbackPoll && (fallbackPollState || fallbackPoll)) {
      const sourcePoll = fallbackPollState || fallbackPoll;
      const options = sourcePoll.options;
      if (!options || !Array.isArray(options) || options.length === 0) return null;
      if (!sourcePoll.question) return null;

      const normalizedOptions = options.map((opt, idx) => ({
        id: opt.id || opt.option_id || `opt_${idx}`,
        text: opt.text || opt.name || "",
        suggested: opt.suggested || false,
        suggestedBy: opt.suggestedBy || opt.suggested_by || null,
        status: opt.status || opt.suggested_status || null,
      }));
      const mergedOptions = mergeOptionsById(normalizedOptions, pollSuggestions);
      const voteCounts =
        sourcePoll.vote_counts_by_option ||
        sourcePoll.votes ||
        sourcePoll.vote_counts ||
        {};
      const totalVotes =
        sourcePoll.total_votes ??
        sourcePoll.vote_count ??
        sourcePoll.totalVotes ??
        null;

      return {
        id: sourcePoll.id || message?.id || "unknown",
        question: sourcePoll.question,
        options: mergedOptions,
        isMultiple: sourcePoll.multiple_answers ?? false,
        maxAnswers: sourcePoll.max_answers ?? 1,
        isAnonymous: sourcePoll.anonymous ?? false,
        allowSuggestions: sourcePoll.allow_suggestions ?? false,
        allowComments: sourcePoll.allow_comments ?? false,
        votes: sourcePoll.votes || {},
        voters: sourcePoll.voters || {},
        voteCounts,
        totalVotes,
      };
    }
    if (isStreamPoll && (streamPollState || streamPoll)) {
      const poll = streamPollState || streamPoll;
      const options = poll.options;
      if (!options || !Array.isArray(options) || options.length === 0) return null;

      const normalizedOptions = options.map((opt) => ({
        id: opt.id || opt.option_id,
        text: opt.text || opt.name || "",
        vote_count: opt.vote_count ?? 0,
      }));
      const mergedOptions = mergeOptionsById(normalizedOptions, pollSuggestions);
      const voteCounts = poll.vote_counts_by_option || {};
      const totalVotes =
        poll.total_votes ??
        poll.vote_count ??
        null;

      const derivedOwnVotes = poll.own_votes?.length
        ? poll.own_votes
        : Object.values(poll.latest_votes_by_option || {})
            .flat()
            .filter((vote) => vote?.user_id === currentUserId);

      return {
        id: poll.id,
        question: poll.name || poll.question || "",
        options: mergedOptions,
        isMultiple: (poll.max_votes_allowed ?? 1) > 1,
        maxAnswers: poll.max_votes_allowed ?? 1,
        isAnonymous: poll.voting_visibility === "anonymous",
        allowSuggestions: poll.allow_user_suggested_options ?? false,
        allowComments: poll.allow_answers ?? false,
        ownVotes: derivedOwnVotes || [],
        voteCounts,
        totalVotes,
      };
    }
    return null;
  }, [
    fallbackPoll,
    fallbackPollState,
    streamPoll,
    streamPollState,
    pollSuggestions,
    currentUserId,
    isFallbackPoll,
    isStreamPoll,
    message?.id,
  ]);

  const refreshMessageFromServer = useCallback(async () => {
    if (!message?.id) return null;
    try {
      if (channel?.getMessagesById) {
        const response = await channel.getMessagesById([message.id]);
        const updatedMessage = response?.messages?.[0];
        if (updatedMessage && channel.state?.updateMessage) {
          channel.state.updateMessage(updatedMessage);
        }
        return updatedMessage;
      }
      if (channel?.query) {
        const response = await channel.query({ messages: { id: message.id } });
        const updatedMessage = response?.messages?.find((item) => item.id === message.id);
        if (updatedMessage && channel.state?.updateMessage) {
          channel.state.updateMessage(updatedMessage);
        }
        return updatedMessage || null;
      }
    } catch (err) {
      console.error("Refresh message error:", err);
      return null;
    }
    return null;
  }, [channel, message?.id]);

  const refreshStreamPoll = useCallback(async () => {
    if (!client?.getPoll || !streamPollId) return null;
    try {
      const response = await client.getPoll(streamPollId, client?.user?.id || client?.userID);
      if (response?.poll) {
        setStreamPollState(response.poll);
      }
      return response?.poll || null;
    } catch (err) {
      console.error("Refresh poll error:", err);
      return null;
    }
  }, [client, streamPollId]);

  // Load comments count on mount
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
    channel
      .getReplies(messageId, { limit: 100 })
      .then((response) => {
        if (!isActive) return;
        const replies = (response.messages || []).filter((reply) =>
          isCommentReply(reply, messageId)
        );
        setCommentsReplies(replies);
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
  }, [channel, messageId, pollData?.allowComments]);

  useEffect(() => {
    if (!channel || !message?.id) return;

    const handleMessageUpdated = (event) => {
      if (event.message?.id !== message.id) return;
      // Do not reset selection on message.updated (comments/replies trigger it).
    };

    const handlePollEvent = (event) => {
      const eventMessageId = event.message?.id || event.message_id;
      const eventPollId = event.poll?.id || event.poll_id || event.pollId;
      if (eventMessageId === message.id || (streamPollId && eventPollId === streamPollId)) {
        if (isStreamPoll) {
          refreshStreamPoll();
        }
        refreshMessageFromServer();
      }
    };

    // Handle sync pings from other clients - refresh poll data
    const handleNewMessage = (event) => {
      const msg = event.message;
      if (!msg || msg.parent_id !== message.id) return;
      // Check if this is a sync ping
      if (isSyncPing(msg)) {
        // Another client modified the poll, refresh our data
        if (isStreamPoll) {
          refreshStreamPoll();
        }
        refreshMessageFromServer();
      }
    };

    channel.on("message.updated", handleMessageUpdated);
    channel.on("message.new", handleNewMessage);
    channel.on("poll.updated", handlePollEvent);
    channel.on("poll.vote_casted", handlePollEvent);
    channel.on("poll.vote_changed", handlePollEvent);
    channel.on("poll.vote_removed", handlePollEvent);
    channel.on("reaction.new", handlePollEvent);
    channel.on("reaction.deleted", handlePollEvent);

    return () => {
      channel.off("message.updated", handleMessageUpdated);
      channel.off("message.new", handleNewMessage);
      channel.off("poll.updated", handlePollEvent);
      channel.off("poll.vote_casted", handlePollEvent);
      channel.off("poll.vote_changed", handlePollEvent);
      channel.off("poll.vote_removed", handlePollEvent);
      channel.off("reaction.new", handlePollEvent);
      channel.off("reaction.deleted", handlePollEvent);
    };
  }, [
    channel,
    message?.id,
    streamPollId,
    isStreamPoll,
    isFallbackPoll,
    streamPollState,
    fallbackPollState,
    fallbackPoll,
    refreshStreamPoll,
    refreshMessageFromServer,
  ]);

  // Listen for new comments
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

  const pollId = pollData?.id || null;
  const question = pollData?.question || "";
  const options = pollData?.options;
  const isMultiple = pollData?.isMultiple ?? false;
  const optionsList = options || EMPTY_ARRAY;
  const maxAnswers = isMultiple ? Math.max(1, optionsList.length) : 1;
  const isAnonymous = pollData?.isAnonymous ?? false;
  const allowSuggestions = pollData?.allowSuggestions ?? false;
  const allowComments = pollData?.allowComments ?? false;
  const votes = pollData?.votes;
  const voters = pollData?.voters;
  const ownVotes = pollData?.ownVotes;
  const voteCounts = pollData?.voteCounts;
  const totalVotesOverride = pollData?.totalVotes ?? null;
  const commentsCount = useMemo(() => commentsReplies.length, [commentsReplies]);
  const acceptedSuggestionIds = useMemo(() => {
    const ids =
      message?.extraData?.accepted_suggestion_ids ||
      message?.accepted_suggestion_ids;
    return Array.isArray(ids) ? ids.filter(Boolean) : EMPTY_ARRAY;
  }, [message?.extraData?.accepted_suggestion_ids, message?.accepted_suggestion_ids]);
  const acceptedSuggestionMap = useMemo(() => {
    const map =
      message?.extraData?.accepted_suggestion_map ||
      message?.accepted_suggestion_map;
    return map && typeof map === "object" ? map : EMPTY_OBJECT;
  }, [message?.extraData?.accepted_suggestion_map, message?.accepted_suggestion_map]);
  // ALL options are voteable (including suggested ones), only exclude status="pending"
  const voteableOptions = useMemo(
    () => optionsList.filter((opt) => opt?.status !== "pending"),
    [optionsList]
  );

  const fallbackVotesByOption = useMemo(() => {
    const result = {};
    const source = voters || EMPTY_OBJECT;
    Object.entries(source).forEach(([optionId, userIds]) => {
      if (!optionId || !Array.isArray(userIds)) return;
      const list = userIds
        .filter((userId) => userId) // Filter out empty/null userIds
        .map((userId) => ({
          userId,
          // Name will be resolved later via resolveVoteName
          name: null,
          username: null,
        }));
      result[optionId] = list;
    });
    return result;
  }, [voters]);

  const serverVotesByOption = useMemo(() => {
    if (!isStreamPoll) return {};
    const poll = streamPollState || streamPoll;
    if (!poll) return {};

    const result = {};
    const pushVote = (optionId, vote) => {
      if (!optionId) return;
      const normalized = normalizeVoteUser(vote);
      if (!normalized) return;
      if (!Array.isArray(result[optionId])) result[optionId] = [];
      if (result[optionId].some((item) => item.userId === normalized.userId)) return;
      result[optionId].push(normalized);
    };

    const byOption =
      poll.latest_votes_by_option ||
      poll.votes_by_option ||
      poll.votes_by_option_id ||
      poll.latest_votes_by_option_id;
    if (byOption && typeof byOption === "object") {
      Object.entries(byOption).forEach(([optionId, votes]) => {
        const list = Array.isArray(votes) ? votes : Object.values(votes || {});
        list.forEach((vote) => pushVote(optionId, vote));
      });
    }

    const flatVotes =
      poll.latest_votes ||
      poll.votes ||
      poll.answers ||
      [];
    if (Array.isArray(flatVotes)) {
      flatVotes.forEach((vote) => {
        const optionId = vote?.option_id || vote?.optionId;
        pushVote(optionId, vote);
      });
    }

    return result;
  }, [isStreamPoll, streamPollState, streamPoll]);

  const streamPollSupportsVoteUsers = useMemo(() => {
    if (!isStreamPoll) return false;
    const poll = streamPollState || streamPoll;
    if (!poll) return false;
    const byOption =
      poll.latest_votes_by_option ||
      poll.votes_by_option ||
      poll.votes_by_option_id ||
      poll.latest_votes_by_option_id;
    const flatVotes =
      poll.latest_votes ||
      poll.votes ||
      poll.answers ||
      [];
    const hasByOption = Boolean(
      byOption &&
        Object.values(byOption).some((list) => Array.isArray(list) && list.length > 0)
    );
    const hasFlat = Array.isArray(flatVotes) && flatVotes.length > 0;
    return hasByOption || hasFlat;
  }, [isStreamPoll, streamPollState, streamPoll]);

  const fallbackSupportsVoteUsers = useMemo(() => {
    if (!isFallbackPoll) return false;
    return Object.values(voters || {}).some((list) => Array.isArray(list) && list.length > 0);
  }, [isFallbackPoll, voters]);

  const supportsVoteUsers = isStreamPoll ? streamPollSupportsVoteUsers : fallbackSupportsVoteUsers;

  const votesByOption = useMemo(() => {
    const list = voteableOptions;
    const optionIds = list.map((opt) => opt.id).filter(Boolean);
    if (supportsVoteUsers) {
      const base = isStreamPoll ? serverVotesByOption : fallbackVotesByOption;
      return mergeVoteMaps(base, {}, optionIds);
    }
    return {};
  }, [
    voteableOptions,
    supportsVoteUsers,
    isStreamPoll,
    serverVotesByOption,
    fallbackVotesByOption,
  ]);

  const resolveVoteName = useCallback(
    (vote) => {
      if (!vote?.userId) return "";
      // Check if this is the current user - show "Вы" only for actual current user
      if (vote.userId === currentUserId) {
        return "Вы";
      }
      // Try to get from cache first
      const cachedUser = userCache[vote.userId] || client?.state?.users?.[vote.userId];
      if (cachedUser) return displayName(cachedUser);
      // Fallback to vote's stored name or just the ID (shortened)
      if (vote.name && vote.name !== "Unknown") return vote.name;
      if (vote.username) return vote.username;
      // Return shortened userId, NOT current user
      const shortId = String(vote.userId).slice(0, 8);
      return shortId || "Unknown";
    },
    [userCache, client, currentUserId]
  );

  const getSuggestionAuthorName = useCallback(
    (reply) => {
      const cachedUser =
        userCache[reply?.user?.id || reply?.user_id] ||
        client?.state?.users?.[reply?.user?.id || reply?.user_id];
      const authorSource = reply?.user || cachedUser || {};
      return (
        authorSource.name ||
        `${authorSource.first_name ?? ""} ${authorSource.last_name ?? ""}`.trim() ||
        authorSource.username ||
        reply?.user_id ||
        "Пользователь"
      );
    },
    [userCache, client]
  );

  const voteUserIds = useMemo(() => {
    const ids = new Set();
    Object.values(votesByOption || {}).forEach((list) => {
      (list || []).forEach((vote) => {
        if (vote?.userId) ids.add(vote.userId);
      });
    });
    return Array.from(ids);
  }, [votesByOption]);

  const pendingSuggestionReplies = useMemo(() => {
    const acceptedIds = new Set([
      ...(acceptedSuggestionIds || []),
      ...Object.keys(acceptedSuggestionMap || {}),
    ]);
    const optionTextSet = new Set(
      (optionsList || [])
        .map((opt) => normalizeSuggestionText(opt.text))
        .filter(Boolean)
    );
    return (suggestionsReplies || []).filter((reply) => {
      const text = getSuggestionText(reply);
      if (!text) return false;
      const status = reply.extraData?.suggestion_status || reply.suggestion_status;
      if (status && status !== "pending") return false;
      if (acceptedIds.has(reply.id)) return false;
      const key = normalizeSuggestionText(text);
      if (key && optionTextSet.has(key)) return false;
      return true;
    });
  }, [suggestionsReplies, acceptedSuggestionIds, acceptedSuggestionMap, optionsList]);

  const pendingSuggestions = useMemo(() => {
    if (!pendingSuggestionReplies.length) return EMPTY_ARRAY;
    const items = [];
    const seen = new Set();
    pendingSuggestionReplies.forEach((reply) => {
      const text = getSuggestionText(reply);
      if (!text) return;
      const key = normalizeSuggestionText(text);
      if (!key || seen.has(key)) return;
      seen.add(key);
      items.push({
        id: reply.id,
        text,
        reply,
      });
    });
    return items;
  }, [pendingSuggestionReplies]);

  useEffect(() => {
    if (!pendingSuggestions.length) return;
    let changed = false;
    pendingSuggestions.forEach((item) => {
      const key = normalizeSuggestionText(item.text);
      if (!key) return;
      const existing = suggestionMetaRef.current.get(key);
      const name = getSuggestionAuthorName(item.reply);
      if (!existing) {
        suggestionOrderRef.current += 1;
        suggestionMetaRef.current.set(key, { name, order: suggestionOrderRef.current });
        changed = true;
        return;
      }
      if (!existing.name && name) {
        suggestionMetaRef.current.set(key, { ...existing, name });
        changed = true;
      }
    });
    if (changed) {
      // keep ref-only cache; no state needed
    }
  }, [pendingSuggestions, getSuggestionAuthorName]);

  const suggestedOptions = useMemo(() => {
    if (!pendingSuggestions.length) return EMPTY_ARRAY;
    return pendingSuggestions
      .map((item) => {
        const key = normalizeSuggestionText(item.text);
        const meta = suggestionMetaRef.current.get(key) || {};
        return {
          id: `suggest_${item.id}`,
          text: item.text,
          suggested: true,
          suggestedByName: meta.name || getSuggestionAuthorName(item.reply),
          isSuggestion: true,
          reply: item.reply,
          order: meta.order || 0,
        };
      })
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [pendingSuggestions, getSuggestionAuthorName]);

  const suggestionUserIds = useMemo(() => {
    const ids = new Set();
    (pendingSuggestions || []).forEach((item) => {
      const reply = item.reply;
      const userId = reply?.user?.id || reply?.user_id;
      if (userId) ids.add(userId);
    });
    return Array.from(ids);
  }, [pendingSuggestions]);

  const userIdsToResolve = useMemo(() => {
    const ids = new Set();
    voteUserIds.forEach((id) => ids.add(id));
    suggestionUserIds.forEach((id) => ids.add(id));
    return Array.from(ids);
  }, [voteUserIds, suggestionUserIds]);

  useEffect(() => {
    if (!client?.queryUsers || userIdsToResolve.length === 0) return;
    const missing = userIdsToResolve.filter(
      (id) =>
        !client?.state?.users?.[id] &&
        !userCache[id] &&
        !inFlightUserIdsRef.current.has(id)
    );
    if (!missing.length) return;
    missing.forEach((id) => inFlightUserIdsRef.current.add(id));

    client
      .queryUsers({ id: { $in: missing } })
      .then((response) => {
        const users = response?.users || [];
        setUserCache((prev) => {
          const next = { ...prev };
          users.forEach((user) => {
            if (user?.id) {
              next[user.id] = user;
            }
          });
          return next;
        });
        missing.forEach((id) => inFlightUserIdsRef.current.delete(id));
      })
      .catch(() => {
        missing.forEach((id) => inFlightUserIdsRef.current.delete(id));
      });
  }, [client, userIdsToResolve, userCache]);

  const ownVotesByOptionId = useMemo(() => {
    const map = new Map();
    const source = ownVotes || EMPTY_ARRAY;
    source
      .filter((vote) => vote?.option_id)
      .forEach((vote) => {
        const voteId = vote.id || vote.vote_id;
        if (vote.option_id && voteId) map.set(vote.option_id, voteId);
      });
    return map;
  }, [ownVotes]);

  useEffect(() => {
    const next = computeSelectedFromPoll({
      isStreamPoll,
      ownVotes,
      voters,
      currentUserId,
    });
    setServerSelectedOptions(new Set(next));
  }, [isStreamPoll, ownVotes, voters, currentUserId, pollId]);

  const votedOptionIds = serverSelectedOptions;
  const hasVoted = votedOptionIds.size > 0;

  const selectionStorageKey =
    messageId && currentUserId
      ? `poll_selected_${messageId}_${currentUserId}`
      : "";

  useEffect(() => {
    if (!selectionStorageKey || hasVoted) return;
    if (selectedOptions.size > 0) return;
    try {
      const raw = sessionStorage.getItem(selectionStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setSelectedOptions(new Set(parsed));
      }
    } catch {
      // ignore
    }
  }, [selectionStorageKey, hasVoted, selectedOptions]);

  useEffect(() => {
    if (!selectionStorageKey) return;
    if (hasVoted) {
      sessionStorage.removeItem(selectionStorageKey);
      return;
    }
    try {
      sessionStorage.setItem(selectionStorageKey, JSON.stringify(Array.from(selectedOptions)));
    } catch {
      // ignore
    }
  }, [selectionStorageKey, selectedOptions, hasVoted]);

  const effectiveSelectedIds = useMemo(() => {
    if (optimisticSelection) return optimisticSelection;
    if (hasVoted) return votedOptionIds;
    return selectedOptions;
  }, [optimisticSelection, hasVoted, votedOptionIds, selectedOptions]);

  // Calculate vote counts from server data
  const computedVoteCounts = useMemo(() => {
    if (isStreamPoll) {
      const countsSource = voteCounts || EMPTY_OBJECT;
      if (Object.keys(countsSource).length) {
        return { ...countsSource };
      }
      const list = voteableOptions;
      return list.reduce((acc, opt) => {
        if (opt?.id) acc[opt.id] = opt.vote_count || 0;
        return acc;
      }, {});
    }
    // Fallback: use votes object from poll_data
    return { ...(votes || EMPTY_OBJECT), ...(voteCounts || EMPTY_OBJECT) };
  }, [isStreamPoll, votes, voteCounts, voteableOptions]);

  // Calculate total votes
  const totalVotes = useMemo(() => {
    if (typeof totalVotesOverride === "number") return totalVotesOverride;
    const counts = Object.values(computedVoteCounts);
    return counts.reduce((sum, count) => sum + (count || 0), 0);
  }, [computedVoteCounts, totalVotesOverride]);

  useEffect(() => {
    if (!hasVoted) return;
    setOptimisticSelection(null);
    setSelectedOptions(new Set());
  }, [pollId, hasVoted]);

  // Build options data for rendering
  const optionsData = useMemo(() => {
    const list = [...voteableOptions, ...suggestedOptions];
    return list.map((opt) => {
      const optId = opt.id;
      const count = opt.isSuggestion ? 0 : computedVoteCounts[optId] || 0;
      const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
      const isVoted = opt.isSuggestion ? false : votedOptionIds.has(optId);
      const isSelected = opt.isSuggestion ? false : effectiveSelectedIds.has(optId);
      const meta = suggestionMetaRef.current.get(normalizeSuggestionText(opt.text));
      const isSuggested = Boolean(opt.suggested || meta);
      const suggestedByName = opt.suggestedByName || meta?.name;
      // Only mark as pending if explicitly set to "pending" status
      // Options added via suggestions are voteable (status is null)
      const status = opt.status || null;
      const isPending = status === "pending";

      return {
        id: optId,
        text: opt.text,
        suggested: isSuggested,
        suggestedBy: opt.suggestedBy,
        suggestedByName,
        isSuggestion: opt.isSuggestion,
        reply: opt.reply,
        status,
        isPending,
        count,
        pct,
        isVoted,
        isSelected,
      };
    });
  }, [
    voteableOptions,
    suggestedOptions,
    computedVoteCounts,
    totalVotes,
    votedOptionIds,
    effectiveSelectedIds,
  ]);

  const canRemoveStreamVote = Boolean(
    channel?.removePollVote || channel?.removeVote || client?.removePollVote
  );

  const castStreamVote = useCallback(
    async (optionId) => {
      if (!message?.id || !pollId) return;
      if (channel?.castPollVote) {
        await channel.castPollVote(message.id, pollId, { option_id: optionId });
        return;
      }
      if (channel?.vote) {
        await channel.vote(message.id, pollId, { option_id: optionId });
        return;
      }
      if (client?.castPollVote) {
        await client.castPollVote(message.id, pollId, { option_id: optionId });
        return;
      }
      throw new Error("Vote API unavailable");
    },
    [channel, client, message?.id, pollId]
  );

  const removeStreamVote = useCallback(
    async (voteId) => {
      if (!message?.id || !pollId || !voteId) return;
      if (channel?.removePollVote) {
        await channel.removePollVote(message.id, pollId, voteId);
        return;
      }
      if (channel?.removeVote) {
        await channel.removeVote(message.id, pollId, voteId);
        return;
      }
      if (client?.removePollVote) {
        await client.removePollVote(message.id, pollId, voteId);
        return;
      }
      throw new Error("Remove vote API unavailable");
    },
    [channel, client, message?.id, pollId]
  );

  const commitFallbackVotes = useCallback(
    async (nextOptionIds) => {
      const sourcePoll = fallbackPollState || fallbackPoll;
      if (voting || !isFallbackPoll || !sourcePoll) return;
      setVoting(true);
      setOptimisticSelection(new Set(nextOptionIds));
      try {
        const newVotes = { ...votes };
        const newVoters = { ...voters };

        // Remove current user's votes
        for (const [optId, userIds] of Object.entries(newVoters)) {
          if (!Array.isArray(userIds)) continue;
          if (userIds.includes(currentUserId)) {
            newVoters[optId] = userIds.filter((id) => id !== currentUserId);
            newVotes[optId] = Math.max(0, (newVotes[optId] || 0) - 1);
          }
        }

        // Add new votes
        for (const optId of nextOptionIds) {
          if (!optId) continue;
          newVotes[optId] = (newVotes[optId] || 0) + 1;
          if (!Array.isArray(newVoters[optId])) newVoters[optId] = [];
          if (!newVoters[optId].includes(currentUserId)) {
            newVoters[optId].push(currentUserId);
          }
        }

        const totalVotesNext = Object.values(newVotes).reduce(
          (sum, count) => sum + (count || 0),
          0
        );

        const updatedPollData = {
          ...sourcePoll,
          votes: newVotes,
          voters: newVoters,
          vote_counts_by_option: newVotes,
          vote_count: totalVotesNext,
          total_votes: totalVotesNext,
          updated_at: new Date().toISOString(),
        };

        // Update local state immediately for optimistic UI
        setFallbackPollState(updatedPollData);

      } catch (err) {
        console.error("Vote error:", err);
        toast.error("Не удалось обновить голосование.");
      } finally {
        setVoting(false);
        setSelectedOptions(new Set());
      }
    },
    [
      voting,
      isFallbackPoll,
      fallbackPollState,
      fallbackPoll,
      votes,
      voters,
      currentUserId,
    ]
  );

  // Handle option click
  const handleOptionClick = useCallback(
    async (optionId, isPending = false) => {
      if (!optionId || voting || isPending) return;

      if (isStreamPoll) {
        // NEW VOTE: Not voted yet (multiple choice)
        if (isMultiple && !hasVoted) {
          setSelectedOptions((prev) => {
            const next = new Set(prev);
            if (next.has(optionId)) {
              next.delete(optionId);
            } else if (next.size < maxAnswers) {
              next.add(optionId);
            }
            return next;
          });
          return;
        }

        // Revote or toggle
        const isCurrentlyVoted = votedOptionIds.has(optionId);
        const nextSelection = new Set(votedOptionIds);

        if (!isMultiple && hasVoted && !isCurrentlyVoted) {
          nextSelection.clear();
          nextSelection.add(optionId);
        } else if (isMultiple) {
          if (isCurrentlyVoted) {
            nextSelection.delete(optionId);
          } else if (nextSelection.size < maxAnswers) {
            nextSelection.add(optionId);
          }
        } else if (!hasVoted) {
          nextSelection.clear();
          nextSelection.add(optionId);
        } else if (isCurrentlyVoted) {
          return;
        }

        if (hasVoted && areSetsEqual(nextSelection, votedOptionIds)) {
          return;
        }

        if (hasVoted && !canRemoveStreamVote) {
          setOptimisticSelection(nextSelection);
          toast.error("SDK не поддерживает переголосование.");
          setTimeout(() => setOptimisticSelection(null), 1200);
          return;
        }

        setVoting(true);
        setOptimisticSelection(nextSelection);
        try {
          if (hasVoted && canRemoveStreamVote) {
            for (const voteId of ownVotesByOptionId.values()) {
              await removeStreamVote(voteId);
            }
          }
          for (const nextId of nextSelection) {
            await castStreamVote(nextId);
          }
          await refreshStreamPoll();
          await refreshMessageFromServer();
        } catch (err) {
          console.error("Vote error:", err);
          toast.error("Не удалось обновить голосование.");
        } finally {
          setVoting(false);
        }
        return;
      }

      // Fallback poll voting
      if (hasVoted) {
        if (isMultiple) {
          const nextSelection = new Set(votedOptionIds);
          if (nextSelection.has(optionId)) {
            nextSelection.delete(optionId);
          } else if (nextSelection.size < maxAnswers) {
            nextSelection.add(optionId);
          }
          await commitFallbackVotes(Array.from(nextSelection));
        } else if (!votedOptionIds.has(optionId)) {
          await commitFallbackVotes([optionId]);
        }
        return;
      }

      if (isMultiple) {
        setSelectedOptions((prev) => {
          const next = new Set(prev);
          if (next.has(optionId)) {
            next.delete(optionId);
          } else if (next.size < maxAnswers) {
            next.add(optionId);
          }
          return next;
        });
      } else {
        await commitFallbackVotes([optionId]);
      }
    },
    [
      voting,
      isStreamPoll,
      isMultiple,
      hasVoted,
      maxAnswers,
      votedOptionIds,
      canRemoveStreamVote,
      ownVotesByOptionId,
      castStreamVote,
      removeStreamVote,
      refreshStreamPoll,
      refreshMessageFromServer,
      commitFallbackVotes,
    ]
  );

  // Handle submit button (multiple choice)
  const handleSubmitVotes = useCallback(async () => {
    if (selectedOptions.size === 0 || voting) return;

    if (isStreamPoll) {
      setVoting(true);
      setOptimisticSelection(new Set(selectedOptions));
      try {
        for (const optionId of selectedOptions) {
          await castStreamVote(optionId);
        }
        await refreshStreamPoll();
        await refreshMessageFromServer();
      } catch (err) {
        console.error("Vote error:", err);
        toast.error("Не удалось отправить голос.");
      } finally {
        setVoting(false);
        setSelectedOptions(new Set());
      }
      return;
    }

    await commitFallbackVotes([...selectedOptions]);
  }, [
    selectedOptions,
    voting,
    isStreamPoll,
    castStreamVote,
    refreshStreamPoll,
    refreshMessageFromServer,
    commitFallbackVotes,
  ]);

  // Send a sync ping to notify other clients about poll changes
  const sendPollSyncPing = useCallback(async () => {
    if (!channel?.sendMessage || !message?.id) return;
    try {
      await channel.sendMessage({
        text: "",
        parent_id: message.id,
        extraData: {
          poll_sync_ping: true,
          poll_message_id: message.id,
          sync_timestamp: Date.now(),
        },
        silent: true, // Don't trigger notifications
      });
    } catch (err) {
      // Sync ping is best-effort, don't fail on error
      console.warn("Sync ping failed:", err);
    }
  }, [channel, message?.id]);

  const addOptionViaSdk = useCallback(
    async (text) => {
      if (!isStreamPoll || !streamPollId) return null;
      const addOption =
        client?.addPollOption ||
        client?.suggestPollOption ||
        client?.createPollOption;
      if (!addOption) return null;
      try {
        const response = await addOption(streamPollId, { text });
        const refreshed = await refreshStreamPoll();
        await refreshMessageFromServer();
        // Send sync ping for other clients
        await sendPollSyncPing();
        return refreshed || response?.poll || response?.message?.poll || null;
      } catch (err) {
        console.error("Add poll option error:", err);
        return null;
      }
    },
    [isStreamPoll, streamPollId, client, refreshStreamPoll, refreshMessageFromServer, sendPollSyncPing]
  );

  // Add new option (suggestions)
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
      if (!trimmed) return;

      if (canPromoteSuggestion) {
        const added = await addOptionViaSdk(trimmed);
        if (added) return;
      }

      // Fallback: send as thread message (will show as "ожидает")
      if (!channel?.sendMessage || !message?.id) return;

      try {
        const response = await channel.sendMessage({
          text: trimmed,
          parent_id: message.id,
          extraData: {
            poll_suggestion: true,
            poll_message_id: message.id,
            suggestion_status: "pending",
            suggestion: trimmed,
            suggestion_text: trimmed,
          },
        });
        if (response?.message) {
          appendSuggestionReply(response.message);
        }
      } catch {
        toast.error("Не удалось отправить предложение.");
      }
    },
    [
      addOptionViaSdk,
      canPromoteSuggestion,
      channel,
      message?.id,
      appendSuggestionReply,
    ]
  );

  const addFallbackOption = useCallback(
    (text) => {
      if (!isFallbackPoll) return null;
      const source = fallbackPollState || fallbackPoll;
      if (!source) return null;
      const normalized = normalizeSuggestionText(text);
      const existing = (source.options || []).find(
        (opt) => normalizeSuggestionText(opt.text) === normalized
      );
      if (existing?.id) return existing.id;

      const optionId = `suggest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setFallbackPollState((prev) => {
        const base = prev || source;
        const prevOptions = Array.isArray(base.options) ? base.options : [];
        if (prevOptions.some((opt) => normalizeSuggestionText(opt.text) === normalized)) {
          return base;
        }
        const nextOptions = [
          ...prevOptions,
          { id: optionId, text, suggested: true },
        ];
        const nextVotes = {
          ...(base.votes || base.vote_counts_by_option || {}),
        };
        if (nextVotes[optionId] == null) nextVotes[optionId] = 0;
        return {
          ...base,
          options: nextOptions,
          votes: nextVotes,
          vote_counts_by_option: nextVotes,
        };
      });
      return optionId;
    },
    [isFallbackPoll, fallbackPollState, fallbackPoll]
  );

  const handleSuggestionVote = useCallback(
    async (reply) => {
      if (!reply) return;
      const suggestionText = getSuggestionText(reply);
      if (!suggestionText) return;
      const normalized = normalizeSuggestionText(suggestionText);
      const existing = (optionsList || []).find(
        (opt) => normalizeSuggestionText(opt.text) === normalized
      );
      if (existing?.id) {
        await handleOptionClick(existing.id, false);
        return;
      }

      if (!isStreamPoll && isFallbackPoll) {
        const fallbackOptionId = addFallbackOption(suggestionText);
        if (fallbackOptionId) {
          await handleOptionClick(fallbackOptionId, false);
        }
        return;
      }

      if (!isStreamPoll) {
        return;
      }

      const updatedPoll = await addOptionViaSdk(suggestionText);
      const poll = updatedPoll || streamPollState || streamPoll;
      const newOption = poll?.options?.find(
        (opt) => normalizeSuggestionText(opt.text) === normalized
      );
      if (newOption?.id) {
        await handleOptionClick(newOption.id, false);
        return;
      }

      await refreshStreamPoll();
      const fallbackPoll = streamPollState || streamPoll;
      const fallbackOption = fallbackPoll?.options?.find(
        (opt) => normalizeSuggestionText(opt.text) === normalized
      );
      if (fallbackOption?.id) {
        await handleOptionClick(fallbackOption.id, false);
        return;
      }
      toast.error("Не удалось добавить вариант для голосования.");
    },
    [
      optionsList,
      handleOptionClick,
      isStreamPoll,
      isFallbackPoll,
      addFallbackOption,
      addOptionViaSdk,
      streamPollState,
      streamPoll,
      refreshStreamPoll,
    ]
  );

  const markSuggestionAccepted = useCallback(
    async (suggestionId) => {
      if (!suggestionId || !message?.id) return false;
      const existingIds =
        (Array.isArray(message?.extraData?.accepted_suggestion_ids)
          ? message.extraData.accepted_suggestion_ids
          : Array.isArray(message?.accepted_suggestion_ids)
            ? message.accepted_suggestion_ids
            : EMPTY_ARRAY) || EMPTY_ARRAY;
      const existingMap =
        (message?.extraData?.accepted_suggestion_map &&
        typeof message.extraData.accepted_suggestion_map === "object"
          ? message.extraData.accepted_suggestion_map
          : message?.accepted_suggestion_map &&
            typeof message.accepted_suggestion_map === "object"
            ? message.accepted_suggestion_map
            : EMPTY_OBJECT) || EMPTY_OBJECT;
      const nextIds = Array.from(new Set([...existingIds, suggestionId]));
      const nextMap = { ...existingMap, [suggestionId]: true };
      const set = { accepted_suggestion_ids: nextIds, accepted_suggestion_map: nextMap };

      try {
        if (typeof channel?.partialUpdateMessage === "function") {
          await channel.partialUpdateMessage(message.id, { set });
        } else if (typeof channel?.updateMessagePartial === "function") {
          await channel.updateMessagePartial({ id: message.id, set });
        } else if (client?.partialUpdateMessage) {
          await client.partialUpdateMessage(message.id, { set });
        } else {
          return false;
        }
        await refreshMessageFromServer();
        return true;
      } catch {
        return false;
      }
    },
    [
      channel,
      client,
      message?.id,
      message?.extraData?.accepted_suggestion_ids,
      message?.accepted_suggestion_ids,
      message?.extraData?.accepted_suggestion_map,
      message?.accepted_suggestion_map,
      refreshMessageFromServer,
    ]
  );

  const handlePromoteSuggestion = useCallback(
    async (reply) => {
      if (!canPromoteSuggestion || !reply) return;
      const suggestionText = extractSuggestionText(reply);
      if (!suggestionText) return;
      const added = await addOptionViaSdk(suggestionText);
      if (!added) return;
      await markSuggestionAccepted(reply.id);
      setSuggestionsReplies((prev) => prev.filter((item) => item.id !== reply.id));
    },
    [canPromoteSuggestion, addOptionViaSdk, markSuggestionAccepted]
  );

  void handlePromoteSuggestion;

  const showVoteButton = isMultiple && !hasVoted && selectedOptions.size > 0;
  const showResults = hasVoted || totalVotes > 0;
  const canOpenSuggestions = Boolean(pollData && allowSuggestions);
  const canOpenComments = Boolean(pollData && allowComments);

  // Vote count text
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

  useEffect(() => {
    if (!channel || !messageId) {
      setSuggestionsReplies([]);
      return;
    }

    const now = Date.now();
    const cache = suggestionsFetchRef.current;
    if (cache.inFlight && cache.id === messageId) return;
    if (cache.id === messageId && now - cache.ts < 5000) return;

    cache.id = messageId;
    cache.ts = now;
    cache.inFlight = true;

    let isActive = true;
    channel
      .getReplies(messageId, { limit: 100 })
      .then((response) => {
        if (!isActive) return;
        const replies = response?.messages || [];
        const suggestions = replies.filter((reply) => isSuggestionReply(reply, messageId));
        setSuggestionsReplies(suggestions);
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
  }, [channel, messageId]);

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

  if (!pollData || optionsList.length === 0 || !question) return null;

  return (
    <div className="poll-card" data-poll-id={pollId}>
      {/* Header with badges */}
      <div className="poll-card-header">
        <span className="poll-card-title">Опрос</span>
        {isAnonymous && <span className="poll-card-badge">Анонимный</span>}
        {isMultiple && <span className="poll-card-badge">Несколько</span>}
      </div>

      {/* Question */}
      <div className="poll-card-question">{question}</div>

      {/* Options */}
      <div className="poll-card-options">
        {optionsData.map((opt) => {
          const optionClasses = [
            "poll-card-option",
            opt.isSelected ? "poll-card-option--selected" : "",
            hasVoted ? "poll-card-option--revotable" : "",
            opt.isPending ? "poll-card-option--pending" : "",
          ]
            .filter(Boolean)
            .join(" ");

          const indicatorClass = isMultiple
            ? `poll-card-checkbox ${opt.isSelected ? "poll-card-checkbox--checked" : ""}`
            : `poll-card-radio ${opt.isSelected ? "poll-card-radio--checked" : ""}`;

          const votersForOption = votesByOption?.[opt.id] || [];
          const visibleVoters = votersForOption.slice(0, 6);
          const extraVoters = Math.max(0, opt.count - visibleVoters.length);
          const hasCompleteList = opt.count > 0 && votersForOption.length >= opt.count;
          const showVotesPopover = hoveredOptionId === opt.id
            ? isAnonymous
              ? opt.count > 0
              : supportsVoteUsers && hasCompleteList
            : false;

          return (
            <div
              key={opt.id}
              className={optionClasses}
              onClick={() =>
                opt.isSuggestion
                  ? handleSuggestionVote(opt.reply)
                  : handleOptionClick(opt.id, opt.isPending)
              }
              onMouseEnter={() => setHoveredOptionId(opt.id)}
              onMouseLeave={() => setHoveredOptionId(null)}
              onFocus={() => setHoveredOptionId(opt.id)}
              onBlur={() => setHoveredOptionId(null)}
              tabIndex={0}
            >
              {/* Progress bar - always visible after voting */}
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
                    <span className="poll-card-option-suggested">
                      {` (предложено${opt.suggestedByName ? ") " + opt.suggestedByName : ")"}`}
                    </span>
                  )}
                  {opt.isPending && !opt.suggested && (
                    <span className="poll-card-option-pending"> (ожидает)</span>
                  )}
                </span>
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
                      ) : votersForOption.length === 0 ? (
                        opt.count > 0 ? `Голосов: ${opt.count}` : "Пока нет голосов"
                      ) : (
                        <>
                          {visibleVoters
                            .map((vote) => {
                              const name = resolveVoteName(vote);
                              return name || null;
                            })
                            .filter((name) => name && name !== "Unknown")
                            .join(", ") || `Голосов: ${opt.count}`}
                          {extraVoters > 0 ? ` +${extraVoters}` : ""}
                        </>
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

      {/* Action buttons: Suggestions & Comments */}
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
                Комментарии{commentsCount > 0 ? ` (${commentsCount})` : ""}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Total votes */}
      <div className="poll-card-total">
        {getVoteCountText(totalVotes)}
        {hasVoted && <span className="poll-card-voted-mark"> • Вы проголосовали</span>}
        {hasVoted && <span className="poll-card-revote-hint"> (клик для переголосования)</span>}
      </div>

      {/* Vote button (multiple choice) */}
      {showVoteButton && (
        <div className="poll-card-footer">
          <button
            type="button"
            className="poll-card-btn poll-card-btn-primary"
            onClick={handleSubmitVotes}
            disabled={voting}
          >
            {voting ? "Отправка..." : "Голосовать"}
          </button>
        </div>
      )}

      {/* Suggestions Modal */}
      {showSuggestionsModal && canOpenSuggestions && (
        <SuggestionsModal
          pollData={pollData}
          onClose={() => setShowSuggestionsModal(false)}
          onAddOption={handleAddOption}
          message={message}
          channel={channel}
        />
      )}

      {/* Comments Modal */}
      {showCommentsModal && canOpenComments && (
        <CommentsModal
          messageId={message?.id}
          onClose={() => setShowCommentsModal(false)}
          commentsCount={commentsCount}
        />
      )}
    </div>
  );
};

export default PollMessageCard;
