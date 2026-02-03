import { useRef, useState, useEffect } from "react";
import { StreamChat } from "stream-chat";
import { useUser } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken } from "../lib/api";
import * as Sentry from "@sentry/react";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

export const useStreamChat = () => {
  const { user } = useUser();
  const [chatClient, setChatClient] = useState(null);
  const chatClientRef = useRef(null);

  console.log("useStreamChat: user", user);

  const {
    data: tokenData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!user?.id,
  });

  console.log("useStreamChat: tokenData", tokenData, "isLoading", isLoading, "error", error);
  console.log("token string:", tokenData?.token);

  useEffect(() => {
    let cancelled = false;

    const initChat = async () => {
      if (!tokenData || !user) return;

      try {
        const client = StreamChat.getInstance(STREAM_API_KEY);
        console.log("Connecting user:", {
          id: user.id,
          name: user.fullName,
          image: user.profileImageUrl,
        }, "token:", tokenData.token);
        await client.connectUser(
          {
            id: user.id,
            name: user.fullName,
            image: user.profileImageUrl,
          },
          tokenData.token,
          { presence: true }
        );
        if (cancelled) {
          client.disconnectUser().catch(console.error);
          return;
        }
        chatClientRef.current = client;
        setChatClient(client);
      } catch (error) {
        console.log("Ошибка инициализации Stream Chat:", error);
        Sentry.captureException(error, {
          tags: { component: "useStreamChat" },
          extra: {
            context:
              "Ошибка при инициализации Stream Chat в useStreamChat хук",
            userId: user?.id,
            streamApiKey: STREAM_API_KEY ? "present" : "missing",
          },
        });
      }
    };

    initChat();

    return () => {
      cancelled = true;
      if (chatClientRef.current) {
        chatClientRef.current.disconnectUser().catch(console.error);
        chatClientRef.current = null;
      }
      setChatClient(null);
    };
  }, [tokenData, user]);

  return {
    chatClient,
    isLoading,
    error,
  };
};
