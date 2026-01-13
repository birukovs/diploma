import { generateStreamToken } from "../config/stream.js";

export const getStreamToken = async (req, res) => {
  try {
    const token = generateStreamToken(req.auth().userId);

    res.status(200).json({ token });
  } catch (error) {
    console.log("Ошибка при получении токена Stream:", error);
    res.status(500).json({ message: "Ошибка при получении токена Stream" });
  }
};
