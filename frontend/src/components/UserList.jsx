import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useChatContext } from "stream-chat-react";
import * as Sentry from "@sentry/react";
import UserPreview from "./UserPreview";

const UserList = ({ activeChannel, setActiveChannel }) => {
  const { client } = useChatContext();
  const [_, setSearchParams] = useSearchParams();

  const fetchUsers = useCallback(async () => {
    if (!client?.user) return;

    const response = await client.queryUsers(
      { 
        id: { $ne: client.user.id }
      },
      { name: 1 },
      { limit: 20 }
    );

    const usersOnly = response.users.filter((user) => !user.id.startsWith("recording-"));

    return usersOnly;
  }, [client]);

  const {
    data: users = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["users-list", client?.user?.id],
    queryFn: fetchUsers,
    enabled: !!client?.user,
    staleTime: 1000 * 60 * 5,
  });

  const startDirectMessage = async (targetUser) => {
    if (!targetUser || !client?.user) return;

    try {
      const channelId = [client.user.id, targetUser.id]
        .sort()
        .join("-")
        .slice(0, 64);
      const channel = client.channel("messaging", channelId, {
        members: [client.user.id, targetUser.id],
      });
      await channel.watch();
      
      if (setActiveChannel) {
        setActiveChannel(channel);
      } else {
        setSearchParams({ channel: channel.id });
      }
    } catch (error) {
      console.log("Ошибка создания личных сообщений", error),
        Sentry.captureException(error, {
          tags: { component: "UsersList" },
          extra: {
            context: "create_direct_message",
            targetUserId: targetUser?.id,
          },
        });
    }
  };

  if (isLoading)
    return (
      <div className="team-channel-list__message">
        Загрузка пользователей...
      </div>
    );
  if (isError)
    return (
      <div className="team-channel-list__message">
        Ошибка загрузки пользователей
      </div>
    );
  if (!users.length)
    return (
      <div className="team-channel-list__message">Пользователи не найдены</div>
    );

  return (
    <div className="team-channel-list__users">
      {users.map((user) => (
        <UserPreview
          key={user.id}
          user={user}
          client={client}
          activeChannel={activeChannel}
          onSelectUser={startDirectMessage}
        />
      ))}
    </div>
  );
};

export default UserList;
