import { useMemo } from "react";
import {
  useChannelActionContext,
  useMessageContext,
  useTranslationContext,
} from "stream-chat-react";

const getAuthorName = (message, t) =>
  message?.user?.name || message?.user?.id || t("Unknown");

const getSnippet = (message, t, userLanguage) => {
  if (!message) return "";
  if (message.deleted_at || message.type === "deleted") {
    return t("This message was deleted...");
  }
  const i18nText = userLanguage ? message?.i18n?.[`${userLanguage}_text`] : null;
  const text = (i18nText || message.text || "").trim();
  if (text) return text;
  const attachment = message.attachments?.[0];
  return attachment?.title || attachment?.fallback || t("Attachment");
};

const InlineQuotedMessage = () => {
  const { message, isMyMessage } = useMessageContext("InlineQuotedMessage");
  const { t, userLanguage } = useTranslationContext("InlineQuotedMessage");
  const { jumpToMessage } = useChannelActionContext("InlineQuotedMessage");

  const quoted = message?.quoted_message;

  const content = useMemo(() => {
    if (!quoted) return null;
    return {
      author: getAuthorName(quoted, t),
      snippet: getSnippet(quoted, t, userLanguage),
    };
  }, [quoted, t, userLanguage]);

  if (!quoted || !content) return null;

  return (
    <div
      className={`inline-quoted-message${
        isMyMessage?.() ? " inline-quoted-message--mine" : ""
      }`}
      data-testid="quoted-message"
      onClickCapture={(event) => {
        event.stopPropagation();
        event.preventDefault();
        jumpToMessage?.(quoted.id);
      }}
    >
      <div className="inline-quoted-message__bar" />
      <div className="inline-quoted-message__body">
        <div className="inline-quoted-message__author">{content.author}</div>
        <div className="inline-quoted-message__snippet">{content.snippet}</div>
      </div>
    </div>
  );
};

export default InlineQuotedMessage;
