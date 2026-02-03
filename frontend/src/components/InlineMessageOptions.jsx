import { MoreHorizontal, Smile } from "lucide-react";
import { useState } from "react";
import {
  MESSAGE_ACTIONS,
  ThreadIcon as DefaultThreadIcon,
  useMessageContext,
  useTranslationContext,
} from "stream-chat-react";
import InlineMessageActions from "./InlineMessageActions";
import InlineReactionsPicker from "./InlineReactionsPicker";

const InlineMessageOptions = (props) => {
  const {
    ActionsIcon = MoreHorizontal,
    displayReplies: _displayReplies = true,
    handleOpenThread: propHandleOpenThread,
    ReactionIcon = Smile,
    theme = "simple",
    ThreadIcon = DefaultThreadIcon,
  } = props;

  const {
    getMessageActions,
    handleOpenThread: contextHandleOpenThread,
    initialMessage,
    message,
    threadList: _threadList,
  } = useMessageContext("InlineMessageOptions");
  const { t } = useTranslationContext("InlineMessageOptions");

  const [isReactionPickerOpen, setIsReactionPickerOpen] = useState(false);

  const handleOpenThread = propHandleOpenThread || contextHandleOpenThread;
  const messageActions = getMessageActions();
  const shouldShowReactions =
    messageActions.indexOf(MESSAGE_ACTIONS.react) > -1;
  const shouldShowReplies = false;

  if (
    !message?.type ||
    message.type === "error" ||
    message.type === "system" ||
    message.type === "ephemeral" ||
    message.status === "failed" ||
    message.status === "sending" ||
    initialMessage
  ) {
    return null;
  }

  const isActive = isReactionPickerOpen;

  return (
    <div
      className={`str-chat__message-${theme}__actions str-chat__message-options${
        isActive ? " str-chat__message-options--active" : ""
      }`}
      data-testid="message-options"
    >
      <InlineMessageActions ActionsIcon={ActionsIcon} />
      {shouldShowReplies && (
        <button
          aria-label={t("aria/Open Thread")}
          className={`str-chat__message-${theme}__actions__action str-chat__message-${theme}__actions__action--thread str-chat__message-reply-in-thread-button`}
          data-testid="thread-action"
          onClick={handleOpenThread}
        >
          <ThreadIcon className="str-chat__message-action-icon" />
        </button>
      )}
      {shouldShowReactions && (
        <InlineReactionsPicker
          ReactionIcon={ReactionIcon}
          onOpenChange={setIsReactionPickerOpen}
        />
      )}
    </div>
  );
};

export default InlineMessageOptions;
