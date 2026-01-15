import { StreamChat } from 'stream-chat';
import { ENV } from '../config/env.js';

const streamClient = StreamChat.getInstance(ENV.STREAM_API_KEY, ENV.STREAM_API_SECRET);

export const upsertStreamUser = async (userData) => {
    try {
        await streamClient.upsertUser(userData);
        console.log("Пользователь Stream успешно обновлён или создан:", userData.name);
    } catch (error) {
        console.error("Ошибка при обновлении/создании пользователя Stream:", error);
    }
}

export const deleteStreamUser = async (userId) => {
    try {
        console.log("Stream:  attempting to delete user:", userId);
        const res = await streamClient.deleteUser(userId, {
            hard_delete: true,
            mark_messages_deleted: true,
        });
        console.log("Stream: deleteUser response:", res);
        console.log("Пользователь Stream успешно удалён:", userId);
    } catch (error) {
        console.error("Ошибка при удалении пользователя Stream:", error);
        throw error;
    }
}

export const generateStreamToken = (userId) => {
    try {
        const userIdString = userId.toString();
        return streamClient.createToken(userIdString);
    } catch (error) {
        console.error("Ошибка при генерации токена Stream:", error);
        return null;
    }
}

export const addUserToPublicChannels = async (newUserId) => {
  const publicChannels = await streamClient.queryChannels({ discoverable: true });

  for (const channel of publicChannels) {
    await channel.addMembers([newUserId]);
  }
};