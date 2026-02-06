import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  defaultReactionOptions,
  useChatContext,
  useComponentContext,
  useMessageContext,
  useTranslationContext,
} from "stream-chat-react";

const buildReactionOrder = (reactionGroups, reactionOptions) => {
  const optionTypes = reactionOptions.map((option) => option.type);
  const groupTypes = Object.keys(reactionGroups || {});

  const ordered = optionTypes.filter((type) => reactionGroups?.[type]?.count);
  const remaining = groupTypes.filter((type) => !ordered.includes(type));

  return [...ordered, ...remaining];
};

const InlineReactionsList = () => {
  const { message, handleReaction, isMyMessage } =
    useMessageContext("InlineReactionsList");
  const { client } = useChatContext("InlineReactionsList");
  const { userLanguage } = useTranslationContext("InlineReactionsList");
  const { reactionOptions: contextReactionOptions } =
    useComponentContext("InlineReactionsList");
  const currentUserId = client?.userID;

  const reactionOptions = contextReactionOptions || defaultReactionOptions;

  const [tooltipState, setTooltipState] = useState(null);
  const listRef = useRef(null);

  const reactions = useMemo(() => {
    const reactionGroups = message?.reaction_groups || {};
    const ownReactions = message?.own_reactions || [];
    const ownTypes = new Set(ownReactions.map((reaction) => reaction.type));
    const optionsByType = new Map(
      reactionOptions.map((option) => [option.type, option])
    );
    const order = buildReactionOrder(reactionGroups, reactionOptions);

    return order
      .map((type) => {
        const group = reactionGroups?.[type];
        if (!group?.count) return null;
        return {
          type,
          count: group.count,
          isOwn: ownTypes.has(type),
          option: optionsByType.get(type),
        };
      })
      .filter(Boolean);
  }, [message?.reaction_groups, message?.own_reactions, reactionOptions]);

  const buildUserList = useCallback(
    (reactionType, count) => {
      const latestReactions = message?.latest_reactions || [];
      const seen = new Set();
      const users = [];
      const youLabel = userLanguage === "ru" ? "Вы" : "You";

      for (const reaction of latestReactions) {
        if (reaction.type !== reactionType) continue;
        const userId = reaction.user?.id || reaction.user_id;
        if (!userId || seen.has(userId)) continue;
        seen.add(userId);

        let name = reaction.user?.name || userId;
        if (userId === currentUserId) {
          name = youLabel;
        }
        users.push(name);
      }

      const shown = users.slice(0, 5);
      const extra = Math.max(0, (count || 0) - shown.length);
      return { shown, extra };
    },
    [message?.latest_reactions, currentUserId, userLanguage]
  );

  useLayoutEffect(() => {
    const container = listRef.current;
    if (!container) return;

    // Находим пузырь сообщения (работает и для .chat-bubble, и для .str-chat__message-bubble)
    const messageBubble = container.previousElementSibling;
    if (messageBubble?.classList.contains("chat-bubble") ||
        messageBubble?.classList.contains("str-chat__message-bubble")) {
      if (messageBubble instanceof HTMLElement) {
        messageBubble.style.position = "relative";
        messageBubble.style.overflow = "visible";
      }
    }

    // Убеждаемся, что родительский контейнер имеет относительное позиционирование
    const contentWrapper = container.closest(".chat-message-content, .str-chat__message-inner");
    if (contentWrapper instanceof HTMLElement) {
      contentWrapper.style.position = "relative";
      contentWrapper.style.overflow = "visible";
    }
  }, []);

  if (!reactions.length) return null;

  return (
    <div
      className="str-chat__reaction-list str-chat__message-reactions-container inline-reactions-list"
      data-testid="reaction-list"
      role="figure"
      ref={listRef}
      style={{
        position: "absolute",
        bottom: "-10px",
        right: isMyMessage?.() ? "10px" : "auto",
        left: isMyMessage?.() ? "auto" : "10px",
        zIndex: 10,
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      <ul
        className="str-chat__message-reactions inline-reactions-list__items"
        style={{ display: "inline-flex", gap: "6px", flexWrap: "wrap" }}
      >
        {reactions.map(({ type, count, isOwn, option }) => {
          const ReactionComponent = option?.Component;
          const { shown, extra } = buildUserList(type, count);

          return (
            <li
              key={type}
              className={`str-chat__message-reaction${
                isOwn ? " str-chat__message-reaction-own" : ""
              }`}
              onMouseEnter={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setTooltipState({
                  type,
                  count,
                  option,
                  rect,
                  shown,
                  extra,
                  Component: ReactionComponent,
                });
              }}
              onMouseLeave={() => {
                setTooltipState(null);
              }}
            >
              <button
                type="button"
                aria-label={`Reactions: ${type}`}
                data-testid={`reactions-list-button-${type}`}
                onClick={(event) => handleReaction?.(type, event)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  height: "24px",
                  padding: "0 8px",
                  borderRadius: "999px",
                  border: "none",
                  background: isOwn
                    ? "rgba(226, 26, 26, 0.22)"
                    : "rgba(30, 33, 40, 0.85)",
                  color: "rgba(255, 255, 255, 0.95)",
                  fontSize: "13px",
                  lineHeight: "1",
                  boxShadow: "none",
                  outline: "none",
                }}
              >
                <span className="str-chat__message-reaction-emoji">
                  {ReactionComponent ? <ReactionComponent /> : type}
                </span>
                <span className="str-chat__message-reaction-count">{count}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {tooltipState &&
        tooltipState.rect &&
        createPortal(
          <div
            className="reaction-users-tooltip"
            role="tooltip"
            style={{
              position: "fixed",
              left: tooltipState.rect.left + tooltipState.rect.width / 2,
              top: tooltipState.rect.top,
              transform: "translate(-50%, -8px) translateY(-100%)",
              background: "#0f1116",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "12px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
              padding: "8px 10px",
              maxWidth: "240px",
              maxHeight: "180px",
              overflow: "auto",
              zIndex: 9999,
              pointerEvents: "none",
              fontSize: "0.82rem",
              color: "rgba(255, 255, 255, 0.9)",
            }}
          >
            <div
              className="reaction-users-tooltip__header"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "6px",
              }}
            >
              <span className="reaction-users-tooltip__emoji">
                {tooltipState.Component ? (
                  <tooltipState.Component />
                ) : (
                  tooltipState.type
                )}
              </span>
              <span className="reaction-users-tooltip__count">
                {tooltipState.count}
              </span>
            </div>
            <div
              className="reaction-users-tooltip__list"
              style={{ display: "flex", flexDirection: "column", gap: "2px" }}
            >
              {tooltipState.shown.map((name) => (
                <div key={name}>{name}</div>
              ))}
              {tooltipState.extra > 0 && (
                <div>
                  {userLanguage === "ru"
                    ? `+ еще ${tooltipState.extra}`
                    : `+ ${tooltipState.extra} more`}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default InlineReactionsList;





