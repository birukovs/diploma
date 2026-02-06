import { MessageCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { isSystemUser } from "../lib/userUtils";

const CustomChannelPreview = ({ channel, setActiveChannel, activeChannel }) => {
  const isActive = activeChannel && activeChannel.id === channel.id;
  const [unreadCount, setUnreadCount] = useState(() => {
    const stored = localStorage.getItem(`unread_${channel.id}`);
    if (stored !== null) return parseInt(stored);
    return channel.countUnread();
  });
  
  const isDM =
    channel.data.member_count === 2 && channel.data.id.includes("user_");

  const isSystemChannel = useMemo(() => {
    const name = String(channel.data?.name || "").toLowerCase();
    const id = String(channel.data?.id || channel.id || "").toLowerCase();
    if (name.includes("recording") || name.includes("egress")) return true;
    if (id.includes("recording") || id.includes("egress")) return true;
    const members = Object.values(channel.state.members || {}).map((m) => m.user);
    if (members.length > 0 && members.every((m) => isSystemUser(m))) return true;
    return false;
  }, [channel]);

  useEffect(() => {
    localStorage.setItem(`unread_${channel.id}`, String(unreadCount));
  }, [channel.id, unreadCount]);

  useEffect(() => {
    const handleNewMessage = () => {
      if (!isActive) {
        setUnreadCount(prev => prev + 1);
      }
    };

    channel.on("message.new", handleNewMessage);
    return () => channel.off("message.new", handleNewMessage);
  }, [channel, isActive]);

  const handleClick = () => {
    setUnreadCount(0);
    localStorage.setItem(`unread_${channel.id}`, "0");
    setActiveChannel(channel);
  };

  if (isDM || isSystemChannel) return null;

  return (
    <button
      onClick={handleClick}
      className={`str-chat__channel-preview-messenger transition-colors flex items-center w-full text-left px-4 py-2 rounded-lg mb-1 font-medium hover:bg-blue-50/80 min-h-9 ${
        isActive
          ? "bg-black/25! !hover:bg-black/30 border-l-8 border-red-700 shadow-lg text-white/85"
          : ""
      }`}
    >
      <MessageCircle className="w-4 h-4 text-[#9b9b9b] mr-2" />
      <span className="str-chat__channel-preview-messenger-name flex-1">{channel.data.name}</span>

      {unreadCount > 0 && !isActive && (
        <span className="flex items-center justify-center ml-2 size-4 text-xs rounded-full bg-red-500 ">
          {unreadCount}
        </span>
      )}
    </button>
  );
};

export default CustomChannelPreview;
