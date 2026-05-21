import { StreamChat } from "stream-chat";
import { ENV } from "../config/env.js";

const streamClient = StreamChat.getInstance(
  ENV.STREAM_API_KEY,
  ENV.STREAM_API_SECRET
);

export const upsertStreamUser = async (userData) => {
  try {
    await streamClient.upsertUser(userData);
    console.log("Stream user upserted:", userData.id);
  } catch (error) {
    console.error("Failed to upsert Stream user:", error);
    throw error;
  }
};

export const deleteStreamUser = async (userId) => {
  try {
    console.log("Stream: attempting to delete user:", userId);
    const res = await streamClient.deleteUser(userId, {
      hard_delete: true,
      mark_messages_deleted: true,
    });
    console.log("Stream: deleteUser response:", res);
    console.log("Stream user deleted:", userId);
  } catch (error) {
    console.error("Failed to delete Stream user:", error);
    throw error;
  }
};

export const generateStreamToken = (userId) => {
  try {
    return streamClient.createToken(String(userId));
  } catch (error) {
    console.error("Failed to generate Stream token:", error);
    return null;
  }
};

export const addUserToPublicChannels = async (newUserId) => {
  const publicChannels = await streamClient.queryChannels({
    type: "messaging",
    $or: [{ discoverable: true }, { visibility: "public" }],
  });

  for (const channel of publicChannels) {
    try {
      await channel.addMembers([newUserId]);
    } catch (error) {
      // Keep operation idempotent if member already exists.
      const message = String(error?.message || "");
      if (!message.toLowerCase().includes("already")) {
        console.error(
          `Failed to add user ${newUserId} to public channel ${channel?.id}:`,
          error
        );
      }
    }
  }
};
