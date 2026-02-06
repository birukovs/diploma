/* eslint react-refresh/only-export-components: off */
// Отключаем правило react-refresh/only-export-components для этого файла
import { createContext, useCallback, useContext, useMemo, useState } from "react";

const InlineComposerContext = createContext(null);

export const InlineComposerProvider = ({ children }) => {
  const [editingMessage, setEditingMessageState] = useState(null);
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);

  const setEditingMessage = useCallback((message) => {
    setEditingMessageState(message || null);
  }, []);

  const clearEditingMessage = useCallback(() => {
    setEditingMessageState(null);
  }, []);

  const openPollModal = useCallback(() => {
    setIsPollModalOpen(true);
  }, []);

  const closePollModal = useCallback(() => {
    setIsPollModalOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      editingMessage,
      setEditingMessage,
      clearEditingMessage,
      isPollModalOpen,
      openPollModal,
      closePollModal,
    }),
    [editingMessage, setEditingMessage, clearEditingMessage, isPollModalOpen, openPollModal, closePollModal]
  );

  return (
    <InlineComposerContext.Provider value={value}>
      {children}
    </InlineComposerContext.Provider>
  );
};

export const useInlineComposer = () => {
  const context = useContext(InlineComposerContext);
  if (!context) {
    throw new Error("useInlineComposer must be used within InlineComposerProvider");
  }
  return context;
};
