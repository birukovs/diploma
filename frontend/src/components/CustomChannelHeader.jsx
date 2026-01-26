import { MessageCircle, LockIcon, UsersIcon, PinIcon, VideoIcon } from "lucide-react";
import { useChannelStateContext, useChatContext } from "stream-chat-react";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import MembersModal from "./MembersModal";
import PinnedMessagesModal from "./PinnedMessagesModal";
import InviteModal from "./InviteModal";

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
    (member) => member.user.id !== user.id
  );

  const isDM =
    channel.data?.member_count === 2 && channel.data?.id.includes("user_");

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

          <span className="font-medium text-white">
            {isDM
              ? otherUser?.user?.name || otherUser?.user?.id
              : channel.data?.id}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="flex items-center gap-2 bg-transparent hover:bg-transparent py-1 px-2 rounded"
          onClick={() => setShowMembers(true)}
        >
          <UsersIcon className="size-5 text-[#e21a1a]" />
          <span className="text-sm text-white">{memberCount}</span>
        </button>

        <button
          className="p-1 rounded hover:bg-transparent hover:border-transparent"
          onClick={handleVideoCall}
          title="Start Video Call"
        >
          <VideoIcon className="size-5 text-[#e21a1a]" />
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
          <PinIcon className="size-5 text-[#e21a1a]" />
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
