import { XIcon } from "lucide-react";
import { useEffect, useState } from "react";


function MembersModal({ channel, members, currentUserId, currentUser, client, onClose }) {
  const [allMembers, setAllMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllMembers = async () => {
      try {
        await channel.query({ members: { limit: 100 } });

        let membersList = Object.values(channel.state.members);
        console.log("All channel members:", membersList);
        console.log("Channel data:", channel.data);
        console.log("Created by:", channel.data?.created_by);
        console.log("Current user ID:", currentUserId);

        const existingIds = new Set(membersList.map(m => m.user?.id));

        const creator = channel?.data?.created_by;
        const creatorId = channel?.data?.created_by_id || creator?.id;

        if (creatorId && !existingIds.has(creatorId)) {
          console.log("Adding creator to list:", creatorId);
          membersList.push({
            user: {
              id: creatorId,
              name: creator?.name || creatorId,
              image: creator?.image,
            }
          });
          existingIds.add(creatorId);
        }

        if (currentUserId && !existingIds.has(currentUserId)) {
          console.log("Adding current user to list:", currentUserId);
          membersList.push({
            user: {
              id: currentUserId,
              name: currentUser?.fullName || currentUserId,
              image: currentUser?.imageUrl || currentUser?.profileImageUrl,
            }
          });
          existingIds.add(currentUserId);
        }

        if (client && !existingIds.has("semyon0")) {
          try {
            const res = await client.queryUsers({ id: { $eq: "semyon0" } }, {}, { limit: 1 });
            const semUser = res?.users?.[0];
            if (semUser) {
              membersList.push({
                user: {
                  id: semUser.id,
                  name: semUser.name || semUser.id,
                  image: semUser.image,
                },
              });
              existingIds.add(semUser.id);
            }
          } catch (err) {
            console.error("Error fetching semyon0:", err);
          }
        }

        console.log("Final member list count:", membersList.length);
        setAllMembers(membersList);
      } catch (error) {
        console.error("Error fetching members:", error);
        setAllMembers(members);
      } finally {
        setLoading(false);
      }
    };

    fetchAllMembers();
  }, [channel, members, currentUserId, currentUser, client]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-black rounded-xl shadow-2xl w-full max-w-lg mx-4">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-2xl font-semibold">Участники канала</h2>
          <button onClick={onClose} className="text-2xl text-gray-500 hover:text-gray-700">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* MEMBERS LIST */}
        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          {loading ? (
            <p className="text-gray-500">Загрузка участников...</p>
          ) : allMembers.length === 0 ? (
            <p className="text-gray-500">Нет участников</p>
          ) : (
            allMembers.map((member) => (
              <div
                key={member.user.id}
                className="flex items-center gap-3 py-3 border-b border-gray-200 last:border-b-0"
              >
                {member.user?.image ? (
                  <img
                    src={member.user.image}
                    alt={member.user.name}
                    className="size-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="size-9 rounded-full bg-gray-400 flex items-center justify-center">
                    <span className="text-white">
                      {(member.user.name || member.user.id).charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}

                <div className="text-sm font-medium text-gray-700 mb-1">
                  {member.user.name || member.user.id}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default MembersModal;