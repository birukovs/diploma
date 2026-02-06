import { useLayoutEffect, useRef } from "react";
import {
  MessageText as DefaultMessageText,
  useComponentContext,
  useMessageContext,
  useTranslationContext,
} from "stream-chat-react";
import InlineMessageOptions from "./InlineMessageOptions";
import InlineQuotedMessage from "./InlineQuotedMessage";
import MessageMetaRow from "./MessageMetaRow";
import "../styles/chat-message.css";

const InlineMessage = (props) => {
  const { message, isMyMessage } = useMessageContext("InlineMessage");
  const { MessageOptions: ContextMessageOptions, MessageText } =
    useComponentContext("InlineMessage");
  const { userLanguage } = useTranslationContext("InlineMessage");

  const rowRef = useRef(null);

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
  const isDeleted = message?.type === "deleted" || Boolean(message?.deleted_at);
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
      <MessageMetaRow
        message={message}
        isMine={isMine}
        userLanguage={userLanguage}
        isDeleted={isDeleted}
      />
      <MessageOptions {...props} />
    </div>
  );
};

export default InlineMessage;
