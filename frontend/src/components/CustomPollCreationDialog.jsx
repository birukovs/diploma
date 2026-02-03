import { useState, useCallback } from "react";
import { usePollContext } from "stream-chat-react";

const CustomPollCreationDialog = () => {
  const pollContext = usePollContext();

  const [pollName, setPollName] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multipleAnswers, setMultipleAnswers] = useState(false);
  const [maxVotesAllowed, setMaxVotesAllowed] = useState(2);
  const [anonymous, setAnonymous] = useState(false);
  const [allowUserSuggestedOptions, setAllowUserSuggestedOptions] = useState(false);
  const [allowComments, setAllowComments] = useState(false);

  const handleAddOption = useCallback(() => {
    setOptions((prev) => [...prev, ""]);
  }, []);

  const handleRemoveOption = useCallback((index) => {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleOptionChange = useCallback((index, value) => {
    setOptions((prev) => {
      const newOptions = [...prev];
      newOptions[index] = value;
      return newOptions;
    });
  }, []);

  const handleCreatePoll = useCallback(
    async (e) => {
      e.preventDefault();

      const validOptions = options.filter((opt) => opt.trim() !== "");
      if (!pollName.trim() || validOptions.length < 2) {
        return;
      }

      const pollData = {
        name: pollName,
        options: validOptions.map((text) => ({ text })),
        voting_visibility: anonymous ? "anonymous" : "public",
        allow_user_suggested_options: allowUserSuggestedOptions,
        allow_answers: allowComments,
      };

      if (multipleAnswers) {
        pollData.max_votes_allowed = Math.max(2, Math.min(maxVotesAllowed, validOptions.length));
      }

      try {
        await pollContext?.createPoll?.(pollData);
        setPollName("");
        setOptions(["", ""]);
        setMultipleAnswers(false);
        setMaxVotesAllowed(2);
        setAnonymous(false);
        setAllowUserSuggestedOptions(false);
        setAllowComments(false);
      } catch (error) {
        console.error("Error creating poll:", error);
      }
    },
    [
      pollName,
      options,
      multipleAnswers,
      maxVotesAllowed,
      anonymous,
      allowUserSuggestedOptions,
      allowComments,
      pollContext,
    ]
  );

  const handleCancel = useCallback(() => {
    pollContext?.closePollCreationDialog?.();
  }, [pollContext]);

  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      pollContext?.closePollCreationDialog?.();
    }
  }, [pollContext]);

  return (
    <div className="custom-poll-creation-dialog" onClick={handleBackdropClick}>
      <form onSubmit={handleCreatePoll} className="custom-poll-creation-form">
        <div className="custom-poll-header">
          <h3>Создать опрос</h3>
        </div>

        <div className="custom-poll-body">
          <div className="custom-form-group">
            <label htmlFor="poll-name" className="custom-poll-label">Вопрос</label>
            <input
              id="poll-name"
              type="text"
              value={pollName}
              onChange={(e) => setPollName(e.target.value)}
              placeholder="Задать вопрос…"
              className="custom-poll-input"
              autoFocus
            />
          </div>

          <div className="custom-form-group">
            <label className="custom-poll-label">Варианты</label>
            {options.map((option, index) => (
              <div key={index} className="custom-poll-option-wrapper">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`Вариант ${index + 1}`}
                  className="custom-poll-input"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(index)}
                    className="custom-poll-option-remove"
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
                className="custom-poll-add-option"
              >
                + Добавить вариант
              </button>
            )}
          </div>

          <div className="custom-poll-settings">
            <div className="custom-poll-setting">
              <span className="custom-poll-setting-label">Несколько ответов</span>
              <label className="custom-toggle">
                <input
                  type="checkbox"
                  checked={multipleAnswers}
                  onChange={(e) => setMultipleAnswers(e.target.checked)}
                />
                <span className="custom-toggle-slider"></span>
              </label>
            </div>
            {multipleAnswers && (
              <div className="custom-poll-max-votes-row">
                <label htmlFor="max-votes" className="custom-poll-setting-label">Максимум ответов (2–10)</label>
                <input
                  id="max-votes"
                  type="number"
                  min="2"
                  max={Math.min(10, options.filter(o => o.trim()).length)}
                  value={maxVotesAllowed}
                  onChange={(e) => setMaxVotesAllowed(parseInt(e.target.value, 10))}
                  className="custom-poll-number-input"
                />
              </div>
            )}

            <div className="custom-poll-setting">
              <span className="custom-poll-setting-label">Анонимный опрос</span>
              <label className="custom-toggle">
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                />
                <span className="custom-toggle-slider"></span>
              </label>
            </div>

            <div className="custom-poll-setting">
              <span className="custom-poll-setting-label">Разрешить предложение вариантов</span>
              <label className="custom-toggle">
                <input
                  type="checkbox"
                  checked={allowUserSuggestedOptions}
                  onChange={(e) => setAllowUserSuggestedOptions(e.target.checked)}
                />
                <span className="custom-toggle-slider"></span>
              </label>
            </div>

            <div className="custom-poll-setting">
              <span className="custom-poll-setting-label">Разрешить комментарии</span>
              <label className="custom-toggle">
                <input
                  type="checkbox"
                  checked={allowComments}
                  onChange={(e) => setAllowComments(e.target.checked)}
                />
                <span className="custom-toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div className="custom-poll-footer">
          <button
            type="button"
            onClick={handleCancel}
            className="custom-poll-btn custom-poll-btn-secondary"
          >
            Отмена
          </button>
          <button
            type="submit"
            className="custom-poll-btn custom-poll-btn-primary"
            disabled={!pollName.trim() || options.filter(o => o.trim()).length < 2}
          >
            Создать
          </button>
        </div>
      </form>
    </div>
  );
};

export default CustomPollCreationDialog;
