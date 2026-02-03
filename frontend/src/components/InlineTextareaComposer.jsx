import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import Textarea from "react-textarea-autosize";
import {
  SuggestionList as DefaultSuggestionList,
  useComponentContext,
  useMessageComposer,
  useMessageContext,
  useMessageInputContext,
  useStateStore,
  useTranslationContext,
} from "stream-chat-react";
import { useInlineComposer } from "./InlineComposerContext";

const textComposerStateSelector = (state) => ({
  selection: state.selection,
  suggestions: state.suggestions,
  text: state.text,
});

const searchSourceStateSelector = (state) => ({
  isLoadingItems: state.isLoading,
  items: state.items,
});

const configStateSelector = (state) => ({
  enabled: state.text.enabled,
});

const messageComposerStateSelector = (state) => ({
  quotedMessage: state.quotedMessage,
});

const attachmentManagerStateSelector = (state) => ({
  attachments: state.attachments,
});

const defaultShouldSubmit = (event) =>
  event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing;

const InlineTextareaComposer = ({
  className,
  closeSuggestionsOnClickOutside,
  containerClassName,
  listClassName,
  maxRows: maxRowsProp,
  minRows: minRowsProp,
  onBlur,
  onChange,
  onKeyDown,
  onScroll,
  onSelect,
  placeholder: placeholderProp,
  shouldSubmit: shouldSubmitProp,
  ...restTextareaProps
}) => {
  const { t } = useTranslationContext();
  const { AutocompleteSuggestionList = DefaultSuggestionList } =
    useComponentContext();
  const {
    additionalTextareaProps,
    cooldownRemaining,
    focus,
    handleSubmit,
    maxRows: maxRowsContext,
    minRows: minRowsContext,
    onPaste,
    shouldSubmit: shouldSubmitContext,
    textareaRef,
  } = useMessageInputContext();
  const { editing: _editing } = useMessageContext("InlineTextareaComposer");
  const { editingMessage: _editingMessage } = useInlineComposer();

  const maxRows = maxRowsProp ?? maxRowsContext ?? 1;
  const minRows = minRowsProp ?? minRowsContext;
  const placeholder = placeholderProp ?? additionalTextareaProps?.placeholder;
  const shouldSubmit = shouldSubmitProp ?? shouldSubmitContext ?? defaultShouldSubmit;

  const messageComposer = useMessageComposer();
  const { textComposer } = messageComposer;
  const { selection, suggestions, text } = useStateStore(
    textComposer.state,
    textComposerStateSelector
  );
  const { enabled: _enabled } = useStateStore(messageComposer.configState, configStateSelector);
  const { quotedMessage } = useStateStore(
    messageComposer.state,
    messageComposerStateSelector
  );
  const { attachments } = useStateStore(
    messageComposer.attachmentManager.state,
    attachmentManagerStateSelector
  );
  const { isLoadingItems } =
    useStateStore(suggestions?.searchSource.state, searchSourceStateSelector) ?? {};

  const containerRef = useRef(null);
  const [focusedItemIndex, setFocusedItemIndex] = useState(0);
  const [isComposing, setIsComposing] = useState(false);

  const changeHandler = useCallback(
    (e) => {
      onChange?.(e);
      if (!textareaRef.current) return;
      textComposer.handleChange({
        selection: {
          end: textareaRef.current.selectionEnd,
          start: textareaRef.current.selectionStart,
        },
        text: e.target.value,
      });
    },
    [onChange, textComposer, textareaRef]
  );

  const onCompositionEnd = useCallback(() => {
    setIsComposing(false);
  }, []);

  const onCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  const keyDownHandler = (event) => {
    if (onKeyDown) {
      onKeyDown(event);
      return;
    }
    const searchSource = suggestions?.searchSource;
    const loadedItems = searchSource?.items ?? [];
    if (loadedItems.length) {
      if (event.key === "Escape") return textComposer.closeSuggestions();
      if (event.key === "Enter") {
        event.preventDefault();
        textComposer.handleSelect(loadedItems[focusedItemIndex]);
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setFocusedItemIndex((prev) => {
          let nextIndex = prev - 1;
          if (searchSource?.hasNext) {
            nextIndex = prev;
          } else if (nextIndex < 0) {
            nextIndex = loadedItems.length - 1;
          }
          return nextIndex;
        });
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setFocusedItemIndex((prev) => {
          let nextIndex = prev + 1;
          if (searchSource?.hasNext) {
            nextIndex = prev;
          } else if (nextIndex >= loadedItems.length) {
            nextIndex = 0;
          }
          return nextIndex;
        });
      }
    } else if (shouldSubmit(event) && textareaRef.current) {
      if (event.key === "Enter") {
        event.preventDefault();
      }
      handleSubmit();
      textareaRef.current.selectionEnd = 0;
    }
  };

  const scrollHandler = useCallback(
    (event) => {
      if (onScroll) {
        onScroll(event);
      } else {
        textComposer.closeSuggestions();
      }
    },
    [onScroll, textComposer]
  );

  const setSelectionDebounced = useCallback(
    (e) => {
      onSelect?.(e);
      textComposer.setSelection({
        end: e.target.selectionEnd,
        start: e.target.selectionStart,
      });
    },
    [onSelect, textComposer]
  );

  useEffect(() => {
    if (textareaRef.current && !isComposing) {
      textareaRef.current.selectionStart = selection.start;
      textareaRef.current.selectionEnd = selection.end;
    }
  }, [text, textareaRef, selection.start, selection.end, isComposing]);

  useEffect(() => {
    if (!suggestions) return undefined;
    const frame = requestAnimationFrame(() => {
      setFocusedItemIndex(0);
    });
    return () => cancelAnimationFrame(frame);
  }, [suggestions]);

  useEffect(() => {
    const textareaIsFocused = textareaRef.current?.matches(":focus");
    if (!textareaRef.current || textareaIsFocused || !focus) return;
    textareaRef.current.focus();
  }, [attachments, focus, quotedMessage, textareaRef]);

  const isDisabled = !!cooldownRemaining || restTextareaProps.disabled || additionalTextareaProps?.disabled;
  const readOnly = restTextareaProps.readOnly || additionalTextareaProps?.readOnly;

  return (
    <div
      className={clsx(
        "rta",
        "str-chat__textarea str-chat__message-textarea-react-host",
        containerClassName,
        {
          ["rta--loading"]: isLoadingItems,
        }
      )}
      ref={containerRef}
    >
      <Textarea
        {...additionalTextareaProps}
        {...restTextareaProps}
        aria-label={cooldownRemaining ? t("Slow Mode ON") : placeholder}
        className={clsx(
          "rta__textarea",
          "str-chat__textarea__textarea str-chat__message-textarea",
          className
        )}
        data-testid="message-input"
        disabled={isDisabled}
        readOnly={readOnly}
        maxRows={maxRows}
        minRows={minRows}
        onBlur={onBlur}
        onChange={changeHandler}
        onCompositionEnd={onCompositionEnd}
        onCompositionStart={onCompositionStart}
        onKeyDown={keyDownHandler}
        onPaste={onPaste}
        onScroll={scrollHandler}
        onSelect={setSelectionDebounced}
        placeholder={placeholder || t("Type your message")}
        ref={(ref) => {
          textareaRef.current = ref;
        }}
      />
      {!isComposing && (
        <AutocompleteSuggestionList
          className={listClassName}
          closeOnClickOutside={closeSuggestionsOnClickOutside}
          focusedItemIndex={focusedItemIndex}
          setFocusedItemIndex={setFocusedItemIndex}
        />
      )}
    </div>
  );
};

export default InlineTextareaComposer;
