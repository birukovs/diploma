import { addUserToPublicChannels, generateStreamToken } from "../config/stream.js";

export const getStreamToken = async (req, res) => {
  try {
    const userId = req.auth?.().userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Safety net for first login: ensures user can see discoverable channels
    // even if async user-created sync has not run yet.
    await addUserToPublicChannels(userId.toString());

    const token = generateStreamToken(userId);
    if (!token) {
      return res.status(500).json({ message: "Failed to generate Stream token" });
    }

    return res.status(200).json({ token });
  } catch (error) {
    console.error("Failed to get Stream token:", error);
    return res.status(500).json({ message: "Failed to get Stream token" });
  }
};
