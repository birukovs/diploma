import { UserButton, useUser } from "@clerk/clerk-react";
import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router";
import { useStreamChat } from "../hooks/useStreamChat";
import PageLoader from "../components/PageLoader";
import CreateChannelModal from "../components/CreateChannelModal";
import { Chat, Channel, ChannelList, Window } from "stream-chat-react";
import { MessageCircle, PlusIcon, UsersIcon } from "lucide-react";
import CustomChannelPreview from "../components/CustomChannelPreview";
import UserList from "../components/UserList";
import CustomChannelHeader from "../components/CustomChannelHeader";
import InlineMessageList from "../components/InlineMessageList";
import InlineComposerInput from "../components/InlineComposerInput";
import { InlineComposerProvider } from "../components/InlineComposerContext";
import InlineMessageOptions from "../components/InlineMessageOptions";
import InlineQuotedMessage from "../components/InlineQuotedMessage";
import ChatMessage from "../components/ChatMessage";
import { i18nInstance } from "../lib/translations";


const HomePage = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);
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
    if (chatClient?.user?.id) {
      const channelId = searchParams.get("channel");
      if (channelId) {
        return chatClient.channel("messaging", channelId);
      }
    }
    return null;
  }, [chatClient, searchParams]);

  const activeChannel = selectedChannel || urlChannel;

  const handleSelectChannel = useCallback((channel) => {
    setSelectedChannel(channel);
    setSearchParams({ channel: channel.id });
  }, [setSearchParams]);

  if (error) return <p>Что-то пошло не так</p>;
  if (isLoading || !chatClient || !chatClient.user?.id) return <PageLoader />;

  return (
    <div className="chat-wrapper">
      <Chat client={chatClient} i18nInstance={i18nInstance}>
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

                <ChannelList
                  filters={{
                    type: "messaging",
                    $or: [
                      { members: { $in: [chatClient.user.id] } },
                      { discoverable: true },
                    ],
                  }}
                  options={{ state: true, watch: true }}
                  onSelectChannel={handleSelectChannel}
                  Preview={({ channel }) => (
                    <CustomChannelPreview
                      channel={channel}
                      activeChannel={activeChannel}
                      setActiveChannel={handleSelectChannel}
                    />
                  )}
                  List={(props) => (
                    <div className="channel-sections">
                      <div className="section-header">
                        <div className="section-title">
                          <MessageCircle className="size-4" />
                          <span>Каналы</span>
                        </div>
                      </div>

                      {props.loading && <div className="loading-message">Загрузка каналов...</div>}
                      {props.error && <div className="error-message">Ошибка загрузки каналов</div>}

                      <div className="channels-list">{props.children}</div>

                      <div className="section-header direct-messages">
                        <div className="section-title">
                          <UsersIcon className="size-4" />
                          <span>Личные сообщения</span>
                        </div>
                      </div>
                      <UserList activeChannel={activeChannel} setActiveChannel={handleSelectChannel} />
                    </div>
                  )}
                />
              </div>
            </div>
          </div>

          <div className="chat-main">
            {activeChannel ? (
              <Channel
                channel={activeChannel}
                Message={ChatMessage}
                MessageOptions={InlineMessageOptions}
                QuotedMessage={InlineQuotedMessage}
              >
                <InlineComposerProvider>
                  <Window>
                    <CustomChannelHeader />
                    <InlineMessageList
                      messageActions={["react", "reply", "edit", "pin", "delete"]}
                    />
                    <InlineComposerInput />
                  </Window>
                </InlineComposerProvider>

                {/* Thread view removed to keep replies inline */}
              </Channel>
            ) : (
              <div className="flex h-full items-center justify-center text-gray-500">
                Выберите канал, чтобы начать общение
              </div>
            )}
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
