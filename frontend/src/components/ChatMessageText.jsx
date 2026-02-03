import { MessageText, useMessageContext } from "stream-chat-react";

const ChatMessageText = () => {
  const { message } = useMessageContext("ChatMessageText");

  if (!message) return null;

  return (
    <div className="chat-message-text">
      <MessageText message={message} />
    </div>
  );
};

export default ChatMessageText;
