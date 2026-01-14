import { Inngest } from "inngest";
import { connectDB } from "./db.js";
import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import { upsertStreamUser, deleteStreamUser } from "./stream.js";

export const inngest = new Inngest({ id: "diploma" });

const extractUsername = (data) =>
  data.username ||
  data.public_metadata?.username ||
  data.private_metadata?.username ||
  data.unsafe_metadata?.username ||
  data.user_metadata?.username ||
  data.profile?.username;

const extractPassword = (data) =>
  data.password ||
  data.private_metadata?.password ||
  data.unsafe_metadata?.password ||
  data.public_metadata?.password ||
  data.user_metadata?.password;

const syncUser = inngest.createFunction(
  { id: "sync-user" },
  { event: "clerk/user.created" },
  async ({ event }) => {
    await connectDB();

    console.log('Inngest sync-user event keys:', Object.keys(event.data));

    const { id, email_addresses, first_name, last_name, image_url } = event.data;
    const username = extractUsername(event.data);
    const password = extractPassword(event.data);

    const newUser = {
      clerkId: id,
      email: email_addresses[0]?.email_address,
      name: `${first_name || " "} ${last_name || " "}`,
      avatar: image_url,
      ...(username ? { username } : {}),
      ...(password ? { password: bcrypt.hashSync(password, 10) } : {}),
    };

    try {
      const saved = await User.findOneAndUpdate(
        { clerkId: id },
        newUser,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`Inngest: upsert user ${id} username:${username ? 'yes' : 'no'}`);
      console.log('Inngest: saved.username =', saved?.username || 'none');

      await upsertStreamUser({
        id: newUser.clerkId.toString(),
        name: newUser.name,
        image: newUser.avatar,
        ...(saved?.username ? { username: saved.username } : {}),
      })
    } catch (err) {
      console.error(`Inngest: error upserting user ${id}:`, err);
    }
  }
);

const updateUser = inngest.createFunction(
  { id: "update-user" },
  { event: "clerk/user.updated" },
  async ({ event }) => {
    await connectDB();

    console.log('Inngest update-user event keys:', Object.keys(event.data));

    const { id, email_addresses, first_name, last_name, image_url } = event.data;
    const username = extractUsername(event.data);
    const password = extractPassword(event.data);

    const updated = {
      email: email_addresses[0]?.email_address,
      name: `${first_name || " "} ${last_name || " "}`,
      avatar: image_url,
      ...(username ? { username } : {}),
      ...(password ? { password: bcrypt.hashSync(password, 10) } : {}),
    };

    try {
      const saved = await User.findOneAndUpdate({ clerkId: id }, updated, { upsert: true, new: true });
      console.log(`Inngest: updated user ${id} username:${username ? 'yes' : 'no'}`);
      console.log('Inngest: saved.username =', saved?.username || 'none');

      await upsertStreamUser({
        id: id.toString(),
        name: updated.name,
        image: updated.avatar,
        ...(saved?.username ? { username: saved.username } : {}),
      });
    } catch (err) {
      console.error(`Inngest: error updating user ${id}:`, err);
    }
  }
);

const deleteUser = inngest.createFunction(
  { id: "delete-user" },
  { event: "clerk/user.deleted" },
  async ({ event }) => {
    await connectDB();
    const { id } = event.data;
    console.log(`Inngest: deleting user ${id} from DB and Stream`);
    await User.deleteOne({ clerkId: id });
    
    try {
      await deleteStreamUser(id.toString());
      console.log(`Inngest: Stream delete attempt finished for user ${id}`);
    } catch (err) {
      console.error(`Inngest: Stream delete failed for user ${id}:`, err);
    }
  }
);

export const functions = [syncUser, updateUser, deleteUser];
