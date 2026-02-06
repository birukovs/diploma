import { useCallback, useMemo } from "react";
import { MessageInput, MessageProvider, useChannelStateContext } from "stream-chat-react";
import InlineMessageInput from "./InlineMessageInput";
import PollCreateModal from "./PollCreateModal";
import { useInlineComposer } from "./InlineComposerContext";

const InlineComposerInput = (props) => {
  const { editingMessage, clearEditingMessage, isPollModalOpen, closePollModal } = useInlineComposer();
  const { channel } = useChannelStateContext("InlineComposerInput");

  const messageContextValue = useMemo(
    () => ({
      editing: Boolean(editingMessage),
      message: editingMessage,
      clearEditingState: clearEditingMessage,
    }),
    [editingMessage, clearEditingMessage]
  );

  const InputComponent = props.Input || InlineMessageInput;
  const doUpdateMessageRequest = useCallback(
    async (message) => {
      if (!channel?.updateMessage || !message) return null;
      const editedAt = new Date().toISOString();

      // Сохраняем в localStorage как надежный fallback
      try {
        const editedMessages = JSON.parse(localStorage.getItem('edited_messages') || '{}');
        editedMessages[message.id] = editedAt;
        localStorage.setItem('edited_messages', JSON.stringify(editedMessages));
      } catch {
        // Игнорируем ошибки localStorage
      }

      return channel.updateMessage({
        ...message,
        text_edited: true,
        text_edited_at: editedAt,
      });
    },
    [channel]
  );

  return (
    <MessageProvider value={messageContextValue}>
      <MessageInput
        {...props}
        Input={InputComponent}
        doUpdateMessageRequest={doUpdateMessageRequest}
        clearEditingState={clearEditingMessage}
      />
      {isPollModalOpen && <PollCreateModal onClose={closePollModal} />}
    </MessageProvider>
  );
};

export default InlineComposerInput;
