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

export const transferUserMembership = async (fromUserId, toUserId) => {
  if (!fromUserId || !toUserId || fromUserId === toUserId) {
    return { migratedChannels: 0 };
  }

  const filter = { type: "messaging", members: { $in: [fromUserId] } };
  const sort = { last_message_at: -1 };
  const allChannels = [];
  const limit = 100;
  let offset = 0;

  while (true) {
    const page = await streamClient.queryChannels(filter, sort, {
      limit,
      offset,
      watch: false,
      state: true,
    });

    if (!page.length) {
      break;
    }

    allChannels.push(...page);
    offset += page.length;

    if (page.length < limit) {
      break;
    }
  }

  let migratedChannels = 0;

  for (const channel of allChannels) {
    try {
      const memberIds = Object.keys(channel.state?.members || {});
      const hasNewMember = memberIds.includes(toUserId);

      if (!hasNewMember) {
        await channel.addMembers([toUserId]);
      }

      // Remove old member to keep DM/private membership consistent.
      await channel.removeMembers([fromUserId]);
      migratedChannels += 1;
    } catch (error) {
      const message = String(error?.message || "").toLowerCase();
      const alreadyExists = message.includes("already");
      const notFound = message.includes("not") && message.includes("member");

      if (!alreadyExists && !notFound) {
        console.error(
          `Failed to transfer channel membership ${channel?.cid} from ${fromUserId} to ${toUserId}:`,
          error
        );
      }
    }
  }

  return { migratedChannels };
};
