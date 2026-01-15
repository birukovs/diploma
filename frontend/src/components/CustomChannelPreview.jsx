import { MessageCircle } from "lucide-react";

const CustomChannelPreview = ({ channel, setActiveChannel, activeChannel }) => {
  const isActive = activeChannel && activeChannel.id === channel.id;
  const isDM =
    channel.data.member_count === 2 && channel.data.id.includes("user_");

  if (isDM) return null;

  const unreadCount = channel.unreadCount;

  return (
    <button
      onClick={() => setActiveChannel(channel)}
      className={`str-chat__channel-preview-messenger transition-colors flex items-center w-full text-left px-4 py-2 rounded-lg mb-1 font-medium hover:bg-blue-50/80 min-h-9 ${
        isActive
          ? "bg-black/25! !hover:bg-black/30 border-l-8 border-red-700 shadow-lg text-white/85"

          : ""
      }`}
    >
        <MessageCircle className="w-4 h-4 text-[#9b9b9b] mr-2" />
      <span className="str-chat__channel-preview-messenger-name flex-1">{channel.data.name}</span>

      {unreadCount > 0 && (
        <span className="flex items-center justify-center ml-2 size-4 text-xs rounded-full bg-red-500 ">
          {unreadCount}
        </span>
      )}
    </button>
  );
};

export default CustomChannelPreview;
