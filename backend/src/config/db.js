import mongoose from "mongoose";
import { ENV } from "./env.js";

export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    const conn = await mongoose.connect(ENV.MONGO_URI);
    console.log("MongoDB connected:", conn.connection.host);
    return conn.connection;
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    throw error;
  }
};
