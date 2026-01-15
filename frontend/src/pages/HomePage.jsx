import { UserButton, useUser } from "@clerk/clerk-react";
import { useState, useMemo } from "react";
import { useSearchParams } from "react-router";
import { useStreamChat } from "../hooks/useStreamChat";
import PageLoader from "../components/PageLoader";
import CreateChannelModal from "../components/CreateChannelModal";
import { Plus } from "lucide-react";
import "../styles/stream-chat-theme.css";

import {
  Chat,
  Channel,
  ChannelList,
  MessageList,
  MessageInput,
  Thread,
  Window,
} from "stream-chat-react";
import { PlusIcon } from "lucide-react";

const HomePage = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedChannel] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const { chatClient, error, isLoading } = useStreamChat();

  console.log("HomePage: user", { user: useUser() });
  console.log(
    "HomePage: chatClient",
    chatClient,
    "error",
    error,
    "isLoading",
    isLoading
  );

  const urlChannel = useMemo(() => {
    if (chatClient) {
      const channelId = searchParams.get("channel");
      if (channelId) {
        return chatClient.channel("messaging", channelId);
      }
    }
    return null;
  }, [chatClient, searchParams]);

  const activeChannel = selectedChannel || urlChannel;

  if (error) return <p>Что-то пошло не так</p>;
  if (isLoading || !chatClient) return <PageLoader />;

  return (
    <div className="chat-wrapper">
      <Chat client={chatClient}>
        <div className="chat-container">
          <div className="str-chat__channel-list">
            <div className="team-channel-list">
              <div className="team-channel-list__header gap-4">
                <div className="brand-container">
                  <span className="brand-name">Мессенджер</span>
                </div>
                <div className="user-button-wrapper">
                  <UserButton />
                </div>
              </div>
              <div className="team-channel-list__content">
                <div className="create-channel-section">
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="create-channel-btn"
                  >
                    <PlusIcon className="size-4" />
                    <span>Создать канал</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="chat-main">
            <Channel channel={activeChannel}>
              <Window>
                {/* <CustomChannelHeader /> */}
                <MessageList />
                <MessageInput />
              </Window>

              <Thread />
            </Channel>
          </div>
        </div>

        {isCreateModalOpen && (
          <CreateChannelModal onClose={() => setIsCreateModalOpen(false)} />
        )}
      </Chat>
    </div>
  );
};

export default HomePage;
