import { useMemo } from "react";
import { CornerUpLeft, X } from "lucide-react";
import {
  useMessageComposer,
  useMessageInputContext,
  useStateStore,
  useTranslationContext,
} from "stream-chat-react";

const getReplyAuthor = (message) =>
  message?.user?.name || message?.user?.id || "Unknown";

const getReplySnippet = (message) => {
  if (!message) return "";
  if (message.text) return message.text;
  const attachment = message.attachments?.[0];
  return attachment?.title || attachment?.fallback || "";
};

const InlineReplyPreview = () => {
  const { textareaRef } = useMessageInputContext();
  const { t } = useTranslationContext();
  const messageComposer = useMessageComposer();
  const { quotedMessage } = useStateStore(messageComposer.state, (state) => ({
    quotedMessage: state.quotedMessage,
  }));

  const content = useMemo(() => {
    if (!quotedMessage) return null;
    const name = getReplyAuthor(quotedMessage);
    const snippet = getReplySnippet(quotedMessage) || "-";
    const title = t
      ? t("Reply to {{user}}", { user: name })
      : `Reply to ${name}`;
    return { title, snippet };
  }, [quotedMessage, t]);

  if (!quotedMessage || !content) return null;

  const handleClear = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (messageComposer?.setQuotedMessage) {
      messageComposer.setQuotedMessage(null);
    }
    if (textareaRef?.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className="inline-reply-preview" role="group" aria-label="Reply">
      <div className="inline-reply-preview__left">
        <CornerUpLeft className="inline-reply-preview__icon" size={16} />
        <div className="inline-reply-preview__text">
          <div className="inline-reply-preview__title">{content.title}</div>
          <div className="inline-reply-preview__snippet">
            {content.snippet}
          </div>
        </div>
      </div>
      <button
        type="button"
        className="inline-reply-preview__close"
        onClick={handleClear}
        aria-label={t ? t("Cancel reply") : "Cancel reply"}
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default InlineReplyPreview;
