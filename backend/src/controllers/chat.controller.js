import {
  addUserToPublicChannels,
  generateStreamToken,
  transferUserMembership,
  upsertStreamUser,
} from "../config/stream.js";
import { User } from "../models/user.model.js";
import { clerkClient } from "@clerk/express";

const extractEmailFromClaims = (claims) =>
  claims?.email ||
  claims?.email_address ||
  claims?.primaryEmailAddress ||
  claims?.primary_email_address ||
  claims?.primary_email;

export const getStreamToken = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const nextUserId = userId.toString();
    let userEmail = extractEmailFromClaims(req.authData?.sessionClaims);

    if (!userEmail) {
      try {
        const clerkUser = await clerkClient.users.getUser(nextUserId);
        userEmail =
          clerkUser?.emailAddresses?.find((item) => item.id === clerkUser.primaryEmailAddressId)
            ?.emailAddress ||
          clerkUser?.emailAddresses?.[0]?.emailAddress;
      } catch (error) {
        console.error("Failed to resolve Clerk user email:", error);
      }
    }

    if (userEmail) {
      try {
        const existingUser = await User.findOne({
          email: { $regex: `^${String(userEmail).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
        });

        if (existingUser && existingUser.clerkId !== nextUserId) {
          const oldUserId = existingUser.clerkId;
          const { migratedChannels } = await transferUserMembership(oldUserId, nextUserId);

          existingUser.clerkId = nextUserId;
          await existingUser.save();

          console.log(
            `Stream membership relinked from ${oldUserId} to ${nextUserId}. Migrated channels: ${migratedChannels}`,
          );
        }
      } catch (error) {
        console.error("User relink warning (token flow continues):", error);
      }
    }

    try {
      await upsertStreamUser({
        id: nextUserId,
      });
    } catch (error) {
      console.error("Stream upsert warning (token flow continues):", error);
    }

    try {
      // Safety net for first login: ensures user can see public channels
      // even if async user-created sync has not run yet.
      await addUserToPublicChannels(nextUserId);
    } catch (error) {
      console.error("Add to public channels warning (token flow continues):", error);
    }

    const token = generateStreamToken(nextUserId);
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
