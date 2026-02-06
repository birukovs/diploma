import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useChatContext } from "stream-chat-react";
import * as Sentry from "@sentry/react";
import UserPreview from "./UserPreview";
import { isSystemUser } from "../lib/userUtils";

const UserList = ({ activeChannel, setActiveChannel, searchQuery = "" }) => {
  const { client } = useChatContext();
  const [_, setSearchParams] = useSearchParams();

  const fetchUsers = useCallback(async () => {
    if (!client?.user) return;

    const response = await client.queryUsers(
      { 
        id: { $ne: client.user.id }
      },
      { name: 1 },
      { limit: 20, presence: true }
    );

    // Убираем системных пользователей (recording-*, egress-*, и т.п.)
    const usersOnly = response.users.filter((user) => !isSystemUser(user));

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
  const [presenceOverrides, setPresenceOverrides] = useState({});

  const usersState = useMemo(() => {
    if (!users?.length) return [];
    return users.map((user) => {
      const onlineOverride = presenceOverrides[user.id];
      if (onlineOverride === undefined) return user;
      return { ...user, online: onlineOverride };
    });
  }, [users, presenceOverrides]);

  const filteredUsers = useMemo(() => {
    const query = String(searchQuery).trim().toLowerCase();
    if (!query) return usersState;
    const tokens = query.split(/\s+/).filter(Boolean);
    return usersState.filter((user) => {
      const haystack = [
        user.name,
        user.username,
        user.first_name,
        user.last_name,
        user.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });
  }, [searchQuery, usersState]);

  const handlePresence = useCallback(
    (event) => {
      const nextUser =
        event?.user ||
        (event?.user_id ? client?.state?.users?.[event.user_id] : null);
      const nextOnline = event?.online ?? nextUser?.online;
      if (!nextUser?.id) return;
      if (nextOnline === undefined) return;
      setPresenceOverrides((prev) => {
        if (prev[nextUser.id] === nextOnline) return prev;
        return { ...prev, [nextUser.id]: nextOnline };
      });
    },
    [client]
  );

  useEffect(() => {
    if (!client) return undefined;
    client.on("user.presence.changed", handlePresence);
    client.on("user.updated", handlePresence);
    return () => {
      client.off("user.presence.changed", handlePresence);
      client.off("user.updated", handlePresence);
    };
  }, [client, handlePresence]);

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
  if (!usersState.length)
    return (
      <div className="team-channel-list__message">Пользователи не найдены</div>
    );

  return (
    <div className="team-channel-list__users" data-ui="system-user-filtered">

      {filteredUsers.length === 0 ? (
        <div className="team-channel-list__message">Ничего не найдено</div>
      ) : (
        filteredUsers.map((user) => (
          <UserPreview
            key={user.id}
            user={user}
            client={client}
            activeChannel={activeChannel}
            onSelectUser={startDirectMessage}
          />
        ))
      )}
    </div>
  );
};

export default UserList;
