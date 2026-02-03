import { useState } from "react";
import { useMessageContext, useChatContext } from "stream-chat-react";

const PollMessage = ({ poll }) => {
  const { message } = useMessageContext("PollMessage");
  const { channel, client } = useChatContext("PollMessage");
  const [localSelectedOptions, setLocalSelectedOptions] = useState(new Set());
  const [showResults, setShowResults] = useState(false);

  const isMultipleChoice = poll?.max_votes_allowed && poll.max_votes_allowed > 1;
  const isAnonymous = poll?.voting_visibility === "anonymous";

  const ownVotes = poll?.own_votes || [];
  const hasVoted = ownVotes.length > 0;
  const votedOptionIds = new Set(ownVotes.map((v) => v.option_id));

  const handleOptionClick = async (optionId) => {
    if (hasVoted) return;

    if (isMultipleChoice) {
      setLocalSelectedOptions((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(optionId)) {
          newSet.delete(optionId);
        } else {
          newSet.add(optionId);
        }
        return newSet;
      });
      return;
    }

    if (!message?.id || !poll?.id) {
      setLocalSelectedOptions(new Set([optionId]));
      return;
    }

    try {
      if (channel?.castPollVote) {
        await channel.castPollVote(message.id, poll.id, { option_id: optionId });
      } else if (client?.castPollVote) {
        await client.castPollVote(message.id, poll.id, { option_id: optionId });
      } else {
        setLocalSelectedOptions(new Set([optionId]));
      }
    } catch (error) {
      console.error("Error voting on poll:", error);
      setLocalSelectedOptions(new Set([optionId]));
    }
  };

  const handleVoteSubmit = async () => {
    if (!isMultipleChoice || localSelectedOptions.size === 0) return;

    if (!message?.id || !poll?.id) {
      return;
    }

    try {
      for (const optionId of localSelectedOptions) {
        if (channel?.castPollVote) {
          await channel.castPollVote(message.id, poll.id, { option_id: optionId });
        } else if (client?.castPollVote) {
          await client.castPollVote(message.id, poll.id, { option_id: optionId });
        }
      }
      setLocalSelectedOptions(new Set());
    } catch (error) {
      console.error("Error voting on poll:", error);
    }
  };

  const handleToggleResults = () => {
    setShowResults((prev) => !prev);
  };

  const totalVotes = poll?.vote_counts_by_option
    ? Object.values(poll.vote_counts_by_option).reduce((sum, count) => sum + count, 0)
    : 0;

  const options = poll?.options
    ? poll.options.map((option) => {
        const voteCount = option.vote_count || 0;
        const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;

        const isSelected = hasVoted
          ? votedOptionIds.has(option.id)
          : localSelectedOptions.has(option.id);

        return {
          ...option,
          voteCount,
          percentage,
          isSelected,
        };
      })
    : [];

  if (!poll) return null;

  const showVoteButton = isMultipleChoice && !hasVoted && localSelectedOptions.size > 0;
  const showResultsButton = hasVoted;
  const showFooter = showVoteButton || showResultsButton;

  return (
    <div className="custom-poll-message">
      <div className="custom-poll-message-header">
        <span className="custom-poll-message-title">Опрос</span>
        {isAnonymous && <span className="custom-poll-badge">Анонимный</span>}
      </div>

      <div className="custom-poll-message-question">{poll.name}</div>

      <div className="custom-poll-message-options">
        {options.map((option) => {
          const inputId = `poll-option-${poll.id}-${option.id}`;
          const inputType = isMultipleChoice ? "checkbox" : "radio";

          return (
            <label
              key={option.id}
              htmlFor={inputId}
              className={`custom-poll-option ${option.isSelected ? "custom-poll-option-selected" : ""} ${hasVoted ? "custom-poll-option-voted" : ""}`}
              onClick={(e) => {
                if (!hasVoted && e.target.tagName !== 'INPUT') {
                  handleOptionClick(option.id);
                }
              }}
            >
              <div className="custom-poll-option-input-wrapper">
                <input
                  type={inputType}
                  id={inputId}
                  name={`poll-${poll.id}`}
                  checked={option.isSelected}
                  onChange={() => handleOptionClick(option.id)}
                  disabled={hasVoted}
                  className="custom-poll-option-input"
                />
                <span className="custom-poll-option-text">{option.text}</span>
              </div>
              {(hasVoted || showResults) && (
                <div className="custom-poll-option-results">
                  <span className="custom-poll-option-percentage">{option.percentage}%</span>
                  <span className="custom-poll-option-count">{option.voteCount}</span>
                </div>
              )}
              {(hasVoted || showResults) && option.percentage > 0 && (
                <div
                  className="custom-poll-option-bar"
                  style={{ width: `${option.percentage}%` }}
                />
              )}
            </label>
          );
        })}
      </div>

      {showFooter && (
        <div className="custom-poll-message-footer">
          {showVoteButton && (
            <button
              type="button"
              onClick={handleVoteSubmit}
              className="custom-poll-vote-btn"
            >
              Голосовать
            </button>
          )}
          {showResultsButton && (
            <button
              type="button"
              onClick={handleToggleResults}
              className="custom-poll-vote-btn custom-poll-btn-secondary"
            >
              {showResults ? "Скрыть результаты" : "Посмотреть результаты"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PollMessage;
