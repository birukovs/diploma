import { useEffect, useState } from "react";
import { useChatContext } from "stream-chat-react";
import { XIcon } from "lucide-react";
import { isSystemUser } from "../lib/userUtils";

const InviteModal = ({ channel, onClose }) => {
  const { client } = useChatContext();

  const [users, setUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [error, setError] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoadingUsers(true);
      setError("");

      try {
        const members = Object.keys(channel.state.members);
        const res = await client.queryUsers({ id: { $nin: members } }, { name: 1 }, { limit: 30 });
        // Убираем системных пользователей (recording-*, egress-*, и т.п.)
        const filteredUsers = res.users.filter(user => !isSystemUser(user));
        setUsers(filteredUsers);
      } catch (error) {
        console.log("Error fetching users", error);
        setError("Не удалось загрузить пользователей");
      } finally {
        setIsLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [channel, client]);

  const handleInvite = async () => {
    if (selectedMembers.length === 0) return;

    setIsInviting(true);
    setError("");

    try {
      await channel.addMembers(selectedMembers);
      onClose();
    } catch (error) {
      setError("Не удалось пригласить пользователей");
      console.log("Error inviting users:", error);
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="create-channel-modal-overlay">
      <div className="create-channel-modal">
        {/* ЗАГОЛОВОК */}
        <div className="create-channel-modal__header">
          <h2>Пригласить пользователей</h2>
          <button onClick={onClose} className="create-channel-modal__close">
            <XIcon className="size-4" />
          </button>
        </div>

        {/* СОДЕРЖИМОЕ */}
        <div className="create-channel-modal__form" data-ui="system-user-filtered-invite">
          {isLoadingUsers && <p>Загрузка пользователей...</p>}
          {error && <p className="form-error">{error}</p>}
          {users.length === 0 && !isLoadingUsers && <p>Пользователи не найдены</p>}

          {users.length > 0 && (
            <div className="members-list invite-members-list">
              {users.map((user) => {
                const isChecked = selectedMembers.includes(user.id);

                return (
                  <label
                    key={user.id}
                    className={`member-item ${isChecked ? "member-item--selected" : ""}`}
                  >
                    <input
                      type="checkbox"
                      className="member-checkbox"
                      value={user.id}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedMembers([...selectedMembers, user.id]);
                        else setSelectedMembers(selectedMembers.filter((id) => id !== user.id));
                      }}
                    />

                    {user.image ? (
                      <img
                        src={user.image}
                        alt={user.name || user.id}
                        className="member-avatar"
                      />
                    ) : (
                      <div className="member-avatar member-avatar-placeholder">
                        {(user.name || user.id).charAt(0).toUpperCase()}
                      </div>
                    )}

                    <span className="member-name">
                      {user.name || user.id}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {/* ДЕЙСТВИЯ */}
          <div className="create-channel-modal__actions mt-4">
            <button className="btn btn-secondary" onClick={onClose} disabled={isInviting}>
              Отмена
            </button>
            <button
              className="btn btn-primary"
              onClick={handleInvite}
              disabled={!selectedMembers.length || isInviting}
            >
              {isInviting ? "Приглашение..." : "Пригласить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InviteModal;
