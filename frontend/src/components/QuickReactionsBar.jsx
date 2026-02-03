const QuickReactionsBar = ({ options, onSelect }) => {
  const safeOptions = (options || []).filter(
    (option) =>
      option &&
      typeof option.type === "string" &&
      option.type !== "more" &&
      option.type !== "..."
  );

  if (!safeOptions.length) return null;

  return (
    <div
      className="quick-reactions-bar"
      role="group"
      aria-label="Quick reactions"
    >
      {safeOptions.map((option) => {
        const ReactionComponent = option.Component;
        return (
          <button
            key={option.type}
            type="button"
            className="quick-reaction-button"
            aria-label={option.name || option.type}
            onClick={(event) => onSelect?.(option.type, event)}
          >
            <span
              className="quick-reaction-emoji"
            >
              {ReactionComponent ? <ReactionComponent /> : option.type}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default QuickReactionsBar;
