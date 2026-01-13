import mongoose from 'mongoose';
import {ENV} from './env.js'; 

export const connectDB = async () => {

    try {
        const conn = await mongoose.connect(ENV.MONGO_URI);

        console.log('Подключение к базе данных успешно установлено:', conn.connection.host);
        
    } catch (error) {
        console.log('Ошибка подключения к базе данных:', error);
        process.exit(1);
    }
}