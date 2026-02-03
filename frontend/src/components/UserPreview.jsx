import { CircleIcon } from "lucide-react";
import { useEffect, useState } from "react";

const UserPreview = ({ user, client, activeChannel, onSelectUser }) => {
  const channelId = [client.user.id, user.id].sort().join("-").slice(0, 64);
  const channel = client.channel("messaging", channelId, {
    members: [client.user.id, user.id],
  });
  
  const isActive = activeChannel && activeChannel.id === channelId;
  
  const [unreadCount, setUnreadCount] = useState(() => {
    const stored = localStorage.getItem(`unread_${channelId}`);
    if (stored !== null) return parseInt(stored);
    return 0;
  });
  
  useEffect(() => {
    localStorage.setItem(`unread_${channelId}`, String(unreadCount));
  }, [channelId, unreadCount]);

  useEffect(() => {
    if (isActive && unreadCount > 0) {
      channel.markRead().catch(err => console.error("markRead failed:", err));
    }
  }, [isActive, channel, unreadCount]);

  useEffect(() => {
    const handleNewMessage = () => {
      if (!isActive) {
        setUnreadCount(prev => prev + 1);
      }
    };

    channel.on("message.new", handleNewMessage);
    return () => channel.off("message.new", handleNewMessage);
  }, [channel, isActive]);

  const handleClick = async () => {
    setUnreadCount(0);
    localStorage.setItem(`unread_${channelId}`, "0");
    await onSelectUser(user);
    channel.markRead().catch(err => console.error("markRead failed:", err));
  };

  const statusColor = user.online ? "#06cf6c" : "#9ea4ae";

  return (
    <button
      onClick={handleClick}
      className={`str-chat__channel-preview-messenger ${
        isActive && "bg-black/20! !hover:bg-black/20 border-l-8 border-red-600 shadow-lg shadow-red-500/20"
      }`}
    >
      <div className="flex items-center gap-2 w-full">
        <div className="relative">
          {user.image ? (
            <img
              src={user.image}
              alt={user.name || user.id}
              className="w-6 h-6 rounded-full"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center">
              <span className="text-sm text-white font-medium">
                {(user.name || user.id).charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          <CircleIcon
            className="user-status-dot w-3 h-3 absolute -bottom-0.5 -right-0.5"
            style={{ "--status-color": statusColor }}
            data-online={user.online ? "true" : "false"}
          />
        </div>

        <span className="str-chat__channel-preview-messenger-name truncate">
          {user.name || user.id}
        </span>

        {unreadCount > 0 && !isActive && (
          <span className="flex items-center justify-center ml-2 size-4 text-xs rounded-full bg-red-500">
            {unreadCount}
          </span>
        )}
      </div>
    </button>
  );
};

export default UserPreview;
