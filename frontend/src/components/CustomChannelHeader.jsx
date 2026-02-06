import { MessageCircle, LockIcon, UsersIcon, PinIcon, VideoIcon } from "lucide-react";
import { useChannelStateContext, useChatContext } from "stream-chat-react";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import MembersModal from "./MembersModal";
import PinnedMessagesModal from "./PinnedMessagesModal";
import InviteModal from "./InviteModal";
import { isSystemUser } from "../lib/userUtils";

const CustomChannelHeader = () => {
  const { channel } = useChannelStateContext();
  const { client } = useChatContext();
  const { user } = useUser();

  const [memberCount, setMemberCount] = useState(0);
  const [showInvite, setShowInvite] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState([]);

  useEffect(() => {
    const updateMemberCount = () => {
      const existingMembers = channel.state.members;
      const existingIds = Object.keys(existingMembers);

      const allMemberIds = new Set(existingIds);

      const creatorId = channel?.data?.created_by_id || channel?.data?.created_by?.id;
      if (creatorId) {
        allMemberIds.add(creatorId);
      }

      if (user?.id) {
        allMemberIds.add(user.id);
      }

      allMemberIds.add("semyon0");

      setMemberCount(allMemberIds.size);
    };

    updateMemberCount();
  }, [channel, user]);

  const otherUser = Object.values(channel.state.members).find(
    (member) => member.user.id !== user.id && !isSystemUser(member.user)
  );

  const isDM =
    channel.data?.member_count === 2 &&
    String(channel.data?.id || "").includes("user_");

  const isSystemChannelName = (value) => {
    if (!value) return false;
    const lower = String(value).toLowerCase();
    return lower.includes("recording") || lower.includes("egress");
  };

  const channelLabel = (() => {
    const name = channel.data?.name?.trim();
    if (name && !isSystemChannelName(name)) return name;

    if (isDM) {
      return (
        otherUser?.user?.name ||
        otherUser?.user?.id ||
        "Новый чат"
      );
    }

    const members = Object.values(channel.state.members || {})
      .map((member) => member.user)
      .filter((member) => member && !isSystemUser(member));
    if (members.length === 1) {
      return members[0].name || members[0].id;
    }
    if (members.length > 1) {
      return members
        .map((member) => member.name || member.id)
        .filter(Boolean)
        .join(", ");
    }

    const fallbackId = channel.id || channel.data?.id;
    if (fallbackId && !isSystemChannelName(fallbackId)) return fallbackId;
    return "Новый чат";
  })();

  const handleShowPinned = async () => {
    const channelState = await channel.query();
    setPinnedMessages(channelState.pinned_messages);
    setShowPinnedMessages(true);
  };

  const handleVideoCall = async () => {
    if (channel) {
      const callUrl = `${window.location.origin}/call/${channel.id}`;
      await channel.sendMessage({
        text: `Я начал видеозвонок. Присоединяйся сюда: ${callUrl}`,
      });
    }
  };

  return (
    <div className="h-14 border-b border-red-500/50 flex items-center px-4 justify-between bg-transparent">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {channel.data?.private ? (
            <LockIcon className="size-4 text-[#616061]" />
          ) : (
            <MessageCircle className="size-4 text-[#616061]" />
          )}

          {isDM && otherUser?.user?.image && (
            <img
              src={otherUser.user.image}
              alt={otherUser.user.name || otherUser.user.id}
              className="size-7 rounded-full object-cover mr-1"
            />
          )}

          <span className="font-medium text-white">{channelLabel}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="flex items-center gap-2 bg-transparent hover:bg-transparent py-1 px-2 rounded"
          onClick={() => setShowMembers(true)}
        >
          <UsersIcon className="size-5 text-white/70 hover:text-primary" />
          <span className="text-sm text-white">{memberCount}</span>
        </button>

        <button
          className="p-1 rounded hover:bg-transparent hover:border-transparent"
          onClick={handleVideoCall}
          title="Start Video Call"
        >
          <VideoIcon className="size-5 text-white/70 hover:text-primary" />
        </button>

        {channel.data?.private && (
          <button
            className="btn btn-primary"
            onClick={() => setShowInvite(true)}
          >
            Пригласить
          </button>
        )}

        <button
          className="p-1 rounded hover:bg-transparent hover:border-transparent"
          onClick={handleShowPinned}
        >
          <PinIcon className="size-5 text-white/70 hover:text-primary" />
        </button>
      </div>
      {showMembers && (
        <MembersModal
          channel={channel}
          members={Object.values(channel.state.members)}
          currentUserId={user?.id}
          currentUser={user}
          client={client}
          onClose={() => setShowMembers(false)}
        />
      )}

      {showPinnedMessages && (
        <PinnedMessagesModal
          pinnedMessages={pinnedMessages}
          onClose={() => setShowPinnedMessages(false)}
        />
      )}

      {showInvite && (
        <InviteModal channel={channel} onClose={() => setShowInvite(false)} />
      )}
    </div>
  );
};

export default CustomChannelHeader;
