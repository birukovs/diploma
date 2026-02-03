import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ComponentProvider,
  MessageInputFlat,
  useAttachmentManagerState,
  useComponentContext,
  useMessageComposer,
  useMessageContext,
  useMessageInputContext,
  useStateStore,
} from "stream-chat-react";
import { BarChart2, Paperclip, Plus, X } from "lucide-react";
import InlineEditBar from "./InlineEditBar";
import InlineReplyPreview from "./InlineReplyPreview";
import { useInlineComposer } from "./InlineComposerContext";

const attachmentConfigSelector = (state) => ({
  acceptedFiles: state.attachments.acceptedFiles,
  maxNumberOfFilesPerMessage: state.attachments.maxNumberOfFilesPerMessage,
});

const InlineAttachmentContext = createContext(null);

const useInlineAttachments = () => {
  const context = useContext(InlineAttachmentContext);
  if (!context) {
    throw new Error("useInlineAttachments must be used within InlineAttachmentProvider");
  }
  return context;
};

const InlineAttachmentProvider = ({ children }) => {
  const { attachments } = useAttachmentManagerState();
  const [attachedFiles, setAttachedFiles] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setAttachedFiles(attachments);
  }, [attachments]);

  const value = useMemo(
    () => ({
      attachedFiles,
      setAttachedFiles,
      fileInputRef,
    }),
    [attachedFiles]
  );

  return (
    <InlineAttachmentContext.Provider value={value}>
      {children}
    </InlineAttachmentContext.Provider>
  );
};

const InlineAttachmentSelector = () => {
  const { fileInputRef, setAttachedFiles } = useInlineAttachments();
  const { cooldownRemaining, textareaRef } = useMessageInputContext();
  const messageComposer = useMessageComposer();
  const { attachmentManager } = messageComposer;
  const { openPollModal } = useInlineComposer();
  const { isUploadEnabled, availableUploadSlots } = useAttachmentManagerState();
  const { acceptedFiles, maxNumberOfFilesPerMessage } = useStateStore(
    messageComposer.configState,
    attachmentConfigSelector
  );

  const disabled = !isUploadEnabled || !!cooldownRemaining || availableUploadSlots <= 0;

  const handleClick = useCallback(() => {
    if (disabled) return;
    fileInputRef.current?.click();
  }, [disabled, fileInputRef]);

  const handleFileChange = useCallback(
    (event) => {
      const { files } = event.target;
      if (!files || files.length === 0) return;
      attachmentManager.uploadFiles(files);
      setAttachedFiles(attachmentManager.attachments);
      textareaRef.current?.focus();
      event.target.value = "";
    },
    [attachmentManager, setAttachedFiles, textareaRef]
  );

  return (
    <div className="inline-attachment-selector">
      <div className="composer-actions">
        <button
          type="button"
          className="poll-input-button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={openPollModal}
          aria-label="Create poll"
        >
          <BarChart2 size={18} />
        </button>
        <button
          type="button"
          className="inline-attachment-button"
          onClick={handleClick}
          disabled={disabled}
          aria-label="Attach file"
        >
          <Plus size={18} />
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="inline-attachment-input"
        hidden
        accept={acceptedFiles?.join(",")}
        multiple={(maxNumberOfFilesPerMessage ?? 1) > 1}
        onChange={handleFileChange}
        disabled={disabled}
      />
    </div>
  );
};

const InlineAttachmentPreviewList = () => {
  const { attachedFiles, setAttachedFiles } = useInlineAttachments();
  const messageComposer = useMessageComposer();

  if (!attachedFiles.length) return null;

  const handleRemove = (localId) => {
    if (!localId) return;
    messageComposer.attachmentManager.removeAttachments([localId]);
    setAttachedFiles((prev) =>
      prev.filter((attachment) => attachment.localMetadata?.id !== localId)
    );
  };

  return (
    <div className="inline-attachment-preview" data-ui="inline-attachment-preview">
      {attachedFiles.map((attachment) => {
        const localId = attachment.localMetadata?.id;
        const name =
          attachment.title ||
          attachment.fallback ||
          attachment.localMetadata?.file?.name ||
          "File";
        return (
          <div
            key={localId || attachment.asset_url || attachment.image_url || name}
            className="inline-attachment-chip"
            data-upload-state={attachment.localMetadata?.uploadState}
          >
            <span className="inline-attachment-chip-icon">
              <Paperclip size={14} />
            </span>
            <span className="inline-attachment-chip-name" title={name}>
              {name}
            </span>
            <button
              type="button"
              className="inline-attachment-chip-remove"
              onClick={() => handleRemove(localId)}
              aria-label="Remove attachment"
              disabled={!localId}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

const InlineMessageInput = (props) => {
  const { editing } = useMessageContext("InlineMessageInput");
  const { editingMessage } = useInlineComposer();
  const isEditing = Boolean(editing) || Boolean(editingMessage);
  const componentContext = useComponentContext("InlineMessageInput");
  const mergedComponents = useMemo(
    () => ({
      ...componentContext,
      AttachmentSelector: InlineAttachmentSelector,
      AttachmentPreviewList: InlineAttachmentPreviewList,
    }),
    [componentContext]
  );

  return (
    <div className="inline-message-input">
      <InlineEditBar />
      {!isEditing && <InlineReplyPreview />}
      <div className="inline-message-input-row">
        <InlineAttachmentProvider>
          <ComponentProvider value={mergedComponents}>
            <MessageInputFlat {...props} />
          </ComponentProvider>
        </InlineAttachmentProvider>
      </div>
    </div>
  );
};

export default InlineMessageInput;
