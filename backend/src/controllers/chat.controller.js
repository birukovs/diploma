import {
  addUserToPublicChannels,
  generateStreamToken,
  upsertStreamUser,
} from "../config/stream.js";

export const getStreamToken = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      await upsertStreamUser({
        id: userId.toString(),
      });
    } catch (error) {
      console.error("Stream upsert warning (token flow continues):", error);
    }

    try {
      // Safety net for first login: ensures user can see public channels
      // even if async user-created sync has not run yet.
      await addUserToPublicChannels(userId.toString());
    } catch (error) {
      console.error("Add to public channels warning (token flow continues):", error);
    }

    const token = generateStreamToken(userId);
    if (!token) {
      return res.status(500).json({
        message: "Failed to generate Stream token",
        diagnostics: {
          hasStreamApiKey: !!process.env.STREAM_API_KEY,
          hasStreamApiSecret: !!process.env.STREAM_API_SECRET,
        },
      });
    }

    return res.status(200).json({ token });
  } catch (error) {
    console.error("Failed to get Stream token:", error);
    return res.status(500).json({
      message: "Failed to get Stream token",
      diagnostics: {
        error: error?.message || "unknown_error",
      },
    });
  }
};
