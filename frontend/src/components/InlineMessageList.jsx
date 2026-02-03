import { useCallback } from "react";
import { MessageList, useMessageComposer } from "stream-chat-react";

const focusComposer = (isThreadReply) => {
  const selector = isThreadReply
    ? ".str-chat__thread .str-chat__textarea__textarea"
    : ".str-chat__textarea__textarea";
  const textarea = document.querySelector(selector);
  if (textarea instanceof HTMLTextAreaElement) {
    textarea.focus();
  }
};

const InlineMessageList = (props) => {
  const messageComposer = useMessageComposer();

  const handleOpenThread = useCallback(
    (message, event) => {
      event?.preventDefault?.();
      if (messageComposer?.setQuotedMessage) {
        messageComposer.setQuotedMessage(message);
        focusComposer(Boolean(message?.parent_id));
      }
    },
    [messageComposer]
  );

  return <MessageList {...props} openThread={handleOpenThread} />;
};

export default InlineMessageList;
