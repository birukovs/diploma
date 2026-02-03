import { useEffect, useRef } from "react";
import { PencilLine, X } from "lucide-react";
import {
  useMessageComposer,
  useMessageInputContext,
  useTranslationContext,
} from "stream-chat-react";
import { useInlineComposer } from "./InlineComposerContext";

const InlineEditBar = () => {
  const { editingMessage, clearEditingMessage } = useInlineComposer();
  const { textareaRef, cooldownRemaining, setCooldownRemaining } = useMessageInputContext();
  const { t } = useTranslationContext("InlineEditBar");
  const messageComposer = useMessageComposer();
  const lastEditedIdRef = useRef(null);

  useEffect(() => {
    if (!editingMessage) {
      lastEditedIdRef.current = null;
      return;
    }

    if (lastEditedIdRef.current === editingMessage.id) {
      return;
    }

    lastEditedIdRef.current = editingMessage.id;
    if (setCooldownRemaining) {
      setCooldownRemaining(0);
    }

    const nextText = editingMessage.text ?? "";
    const composer = messageComposer?.textComposer;
    if (composer?.initState) {
      composer.initState({ message: editingMessage });
    } else if (composer?.setText) {
      composer.setText(nextText);
    }
    if (composer?.setSelection) {
      const cursor = nextText.length;
      composer.setSelection({ start: cursor, end: cursor });
    }
  }, [editingMessage, messageComposer, setCooldownRemaining]);

  useEffect(() => {
    if (!editingMessage) return;
    if (cooldownRemaining && setCooldownRemaining) {
      setCooldownRemaining(0);
    }
    if (messageComposer?.updateConfig && !messageComposer?.configState?.getLatestValue?.()?.text?.enabled) {
      messageComposer.updateConfig({ text: { enabled: true } });
    }
  }, [cooldownRemaining, editingMessage, messageComposer, setCooldownRemaining]);

  useEffect(() => {
    if (!editingMessage) return;
    const frame = requestAnimationFrame(() => {
      const el = textareaRef?.current;
      if (el) {
        el.disabled = false;
        el.readOnly = false;
        if (el.tabIndex < 0) {
          el.tabIndex = 0;
        }
        el.focus();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [editingMessage, textareaRef]);

  if (!editingMessage) return null;

  const author = editingMessage.user?.name || editingMessage.user?.id || "";
  const rawSnippet = editingMessage.text?.trim();
  const snippet = rawSnippet || t("Attachment");

  const handleCancel = (event) => {
    event?.preventDefault?.();
    clearEditingMessage();
    requestAnimationFrame(() => {
      textareaRef?.current?.focus();
    });
  };

  return (
    <div className="inline-edit-bar" data-testid="inline-edit-bar">
      <div className="inline-edit-bar__left">
        <PencilLine className="inline-edit-bar__icon" size={18} />
        <div className="inline-edit-bar__text">
          <span className="inline-edit-bar__title">
            {t("Editing message")} {author ? `- ${author}` : ""}
          </span>
          <span className="inline-edit-bar__snippet">{snippet}</span>
        </div>
      </div>
      <button
        type="button"
        className="inline-edit-bar__close"
        onClick={handleCancel}
        aria-label={t("Cancel")}
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default InlineEditBar;
