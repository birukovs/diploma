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
        await streamClient.deleteUser(userId);
        console.log("Пользователь Stream успешно удалён:", userId);
    } catch (error) {
        console.error("Ошибка при удалении пользователя Stream:", error);
    }
}

export const generateStreamToken = (userId) => {
    try {
        const userId = userId.toString();
        return streamClient.createToken(userIdString);
    } catch (error) {
        console.error("Ошибка при генерации токена Stream:", error);
        return null;
    }
}