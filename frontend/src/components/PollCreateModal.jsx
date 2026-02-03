import { useState, useCallback } from "react";
import { useChannelStateContext } from "stream-chat-react";
import "../styles/polls.css";

const PollCreateModal = ({ onClose }) => {
  const { channel } = useChannelStateContext("PollCreateModal");

  // Form state
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multipleAnswers, setMultipleAnswers] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [allowSuggestions, setAllowSuggestions] = useState(false);
  const [allowComments, setAllowComments] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  // Validation
  const validOptions = options.filter((opt) => opt.trim() !== "");
  const canCreate = question.trim().length > 0 && validOptions.length >= 2;
  // Option handlers
  const handleAddOption = useCallback(() => {
    if (options.length < 10) {
      setOptions((prev) => [...prev, ""]);
    }
  }, [options.length]);

  const handleRemoveOption = useCallback((index) => {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleOptionChange = useCallback((index, value) => {
    setOptions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  // Reset form
  const resetForm = useCallback(() => {
    setQuestion("");
    setOptions(["", ""]);
    setMultipleAnswers(false);
    setAnonymous(false);
    setAllowSuggestions(false);
    setAllowComments(false);
    setError(null);
  }, []);

  // Close modal
  const handleClose = useCallback(() => {
    resetForm();
    onClose?.();
  }, [onClose, resetForm]);

  // Create poll - sends as custom message with poll_data
  const handleCreate = useCallback(
    async (e) => {
      e.preventDefault();
      if (!canCreate || creating) return;

      setCreating(true);
      setError(null);

      try {
        if (!channel?.sendMessage) {
          throw new Error("Канал недоступен");
        }

        // Generate unique poll ID
        const pollId = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Build poll data
        const pollData = {
          id: pollId,
          question: question.trim(),
          options: validOptions.map((text, idx) => ({
            id: `opt_${pollId}_${idx}`,
            text: text.trim(),
          })),
          anonymous,
          multiple_answers: multipleAnswers,
          max_answers: multipleAnswers ? validOptions.length : 1,
          allow_suggestions: allowSuggestions,
          allow_comments: allowComments,
          votes: {}, // { optionId: count }
          voters: {}, // { oderId: [userId, ...] }
          created_at: new Date().toISOString(),
        };

        // Send message with custom poll data
        await channel.sendMessage({
          text: "", // Empty text - poll card will render instead
          custom_type: "poll",
          poll_data: pollData,
        });

        resetForm();
        handleClose();
      } catch (err) {
        console.error("Poll creation error:", err);
        setError(err.message || "Ошибка при создании опроса");
      } finally {
        setCreating(false);
      }
    },
    [
      canCreate,
      creating,
      question,
      validOptions,
      anonymous,
      multipleAnswers,
      allowSuggestions,
      allowComments,
      channel,
      resetForm,
      handleClose,
    ]
  );

  // Backdrop click closes modal
  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose]
  );

  return (
    <div className="poll-create-dialog" onClick={handleBackdropClick}>
      <form className="poll-create-form" onSubmit={handleCreate}>
        <div className="poll-create-header">
          <h3>Создать опрос</h3>
        </div>

        <div className="poll-create-body">
          {/* Question */}
          <div className="poll-create-group">
            <label className="poll-create-label">Вопрос</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Задайте вопрос…"
              className="poll-create-input"
              autoFocus
            />
          </div>

          {/* Options */}
          <div className="poll-create-group">
            <label className="poll-create-label">Варианты ответа</label>
            {options.map((option, index) => (
              <div key={index} className="poll-create-option-wrapper">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`Вариант ${index + 1}`}
                  className="poll-create-input"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(index)}
                    className="poll-create-option-remove"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {options.length < 10 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="poll-create-add-option"
              >
                + Добавить вариант
              </button>
            )}
          </div>

          {/* Settings */}
          <div className="poll-create-settings">
            <div className="poll-create-setting">
              <span className="poll-create-setting-label">Несколько ответов</span>
              <label className="poll-create-toggle">
                <input
                  type="checkbox"
                  checked={multipleAnswers}
                  onChange={(e) => setMultipleAnswers(e.target.checked)}
                />
                <span className="poll-create-toggle-slider" />
              </label>
            </div>

            <div className="poll-create-setting">
              <span className="poll-create-setting-label">Анонимный опрос</span>
              <label className="poll-create-toggle">
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                />
                <span className="poll-create-toggle-slider" />
              </label>
            </div>

            <div className="poll-create-setting">
              <span className="poll-create-setting-label">Предложение вариантов</span>
              <label className="poll-create-toggle">
                <input
                  type="checkbox"
                  checked={allowSuggestions}
                  onChange={(e) => setAllowSuggestions(e.target.checked)}
                />
                <span className="poll-create-toggle-slider" />
              </label>
            </div>

            <div className="poll-create-setting">
              <span className="poll-create-setting-label">Комментарии</span>
              <label className="poll-create-toggle">
                <input
                  type="checkbox"
                  checked={allowComments}
                  onChange={(e) => setAllowComments(e.target.checked)}
                />
                <span className="poll-create-toggle-slider" />
              </label>
            </div>
          </div>

          {error && <div className="poll-create-error">{error}</div>}
        </div>

        <div className="poll-create-footer">
          <button
            type="button"
            onClick={handleClose}
            className="poll-create-btn poll-create-btn-secondary"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={!canCreate || creating}
            className="poll-create-btn poll-create-btn-primary"
          >
            {creating ? "Создание..." : "Создать"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PollCreateModal;
