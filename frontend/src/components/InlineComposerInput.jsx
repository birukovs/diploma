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
      const extraData = {
        ...(message.extraData || message.extra_data || {}),
        edited: true,
      };
      const editedAt = new Date().toISOString();
      return channel.updateMessage({
        ...message,
        edited: true,
        edited_at: editedAt,
        extraData,
        extra_data: extraData,
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
