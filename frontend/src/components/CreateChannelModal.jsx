import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useChatContext } from "stream-chat-react";
import * as Sentry from "@sentry/react";
import toast from "react-hot-toast";
import {
  AlertCircleIcon,
  LockIcon,
  MessageCircle,
  MessageCirclePlus,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { isSystemUser } from "../lib/userUtils";

const buildChannelId = (name) => {
  const base = String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 32);

  const random = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36);
  if (base) return `${base}-${time}-${random}`.slice(0, 64);

  return `channel-${time}-${random}`.slice(0, 64);
};

const CreateChannelModal = ({ onClose }) => {
  const [channelName, setChannelName] = useState("");
  const [channelType, setChannelType] = useState("public");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [, setSearchParams] = useSearchParams();

  const { client, setActiveChannel } = useChatContext();

  useEffect(() => {
    const fetchUsers = async () => {
      if (!client?.user) return;
      setLoadingUsers(true);

      try {
        const response = await client.queryUsers(
          { id: { $ne: client.user.id } },
          { name: 1 },
          { limit: 100 }
        );
        const filteredUsers = (response.users || []).filter((user) => !isSystemUser(user));
        setUsers(filteredUsers);
      } catch (fetchError) {
        console.log("Ошибка при получении пользователей:", fetchError);
        Sentry.captureException(fetchError, {
          tags: { component: "CreateChannelModal" },
          extra: { context: "fetch_users_for_channel" },
        });
        setUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [client]);

  useEffect(() => {
    if (channelType === "public") {
      setSelectedMembers(users.map((u) => u.id));
    } else {
      setSelectedMembers([]);
    }
  }, [channelType, users]);

  const validateChannelName = (name) => {
    if (!name.trim()) return "Введите название канала";
    if (name.length < 3) return "Название канала должно быть не менее 3 символов";
    if (name.length > 24) return "Название канала должно быть не более 24 символов";
    return "";
  };

  const handleChannelNameChange = (e) => {
    const value = e.target.value;
    setChannelName(value);
    setError(validateChannelName(value));
  };

  const handleMemberToggle = (id) => {
    if (selectedMembers.includes(id)) {
      setSelectedMembers(selectedMembers.filter((uid) => uid !== id));
    } else {
      setSelectedMembers([...selectedMembers, id]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateChannelName(channelName);
    if (validationError) return setError(validationError);

    if (channelType === "private" && selectedMembers.length === 0) {
      return setError("Для приватного канала нужно добавить хотя бы одного участника");
    }

    if (isCreating || !client?.user) return;

    setIsCreating(true);
    setError("");

    try {
      const channelId = buildChannelId(channelName);
      const channelData = {
        name: channelName.trim(),
        created_by_id: client.user.id,
        members: [client.user.id, ...selectedMembers],
      };

      if (channelType === "private") {
        channelData.private = true;
        channelData.visibility = "private";
      } else {
        channelData.visibility = "public";
        channelData.discoverable = true;
      }

      const channel = client.channel("messaging", channelId, channelData);
      await channel.watch();

      setActiveChannel(channel);
      setSearchParams({ channel: channel.id });
      toast.success(`Канал "${channelName}" создан успешно`);
      onClose();
    } catch (createError) {
      console.log("Ошибка при создании канала:", createError);
      Sentry.captureException(createError, {
        tags: { component: "CreateChannelModal" },
        extra: {
          context: "create_channel",
          channelName,
          channelType,
          selectedMembersCount: selectedMembers.length,
        },
      });

      const message = createError?.message || "Не удалось создать канал";
      setError(message);
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="create-channel-modal-overlay">
      <div className="create-channel-modal">
        <div className="create-channel-modal__header">
          <h2>Создать канал</h2>
          <button onClick={onClose} className="create-channel-modal__close">
            <XIcon className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="create-channel-modal__form">
          {error && (
            <div className="form-error">
              <AlertCircleIcon className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="channelName">Название канала</label>
            <div className="input-with-icon">
              <MessageCirclePlus className="w-4 h-4 input-icon" />
              <input
                id="channelName"
                type="text"
                value={channelName}
                onChange={handleChannelNameChange}
                placeholder="Название канала"
                className={`form-input ${error ? "form-input--error" : ""}`}
                autoFocus
                maxLength={24}
              />
            </div>

            {channelName && (
              <div className="form-hint">
                ID канала будет: {buildChannelId(channelName)}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Тип канала</label>

            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  value="public"
                  checked={channelType === "public"}
                  onChange={(e) => setChannelType(e.target.value)}
                />
                <div className="radio-content">
                  <MessageCircle className="size-4" />
                  <div>
                    <div className="radio-title">Публичный</div>
                    <div className="radio-description">
                      Каждый может присоединиться к этому каналу
                    </div>
                  </div>
                </div>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  value="private"
                  checked={channelType === "private"}
                  onChange={(e) => setChannelType(e.target.value)}
                />
                <div className="radio-content">
                  <LockIcon className="size-4" />
                  <div>
                    <div className="radio-title">Приватный</div>
                    <div className="radio-description">
                      Только приглашенные участники могут присоединиться
                    </div>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {channelType === "private" && (
            <div className="form-group">
              <label>Добавить участников</label>
              <div className="member-selection-header">
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={() => setSelectedMembers(users.map((u) => u.id))}
                  disabled={loadingUsers || users.length === 0}
                >
                  <UsersIcon className="w-4 h-4" />
                  Выбрать всех
                </button>
                <span className="selected-count">{selectedMembers.length} выбрано</span>
              </div>

              <div className="members-list" data-ui="system-user-filtered-users-list">
                {loadingUsers ? (
                  <p>Загрузка пользователей...</p>
                ) : users.length === 0 ? (
                  <p>Нет пользователей</p>
                ) : (
                  users.map((user) => (
                    <label key={user.id} className="member-item">
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(user.id)}
                        onChange={() => handleMemberToggle(user.id)}
                        className="member-checkbox"
                      />
                      {user.image ? (
                        <img
                          src={user.image}
                          alt={user.name || user.id}
                          className="member-avatar"
                        />
                      ) : (
                        <div className="member-avatar member-avatar-placeholder">
                          <span>{(user.name || user.id).charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                      <span className="member-name">{user.name || user.id}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="description">Описание (необязательно)</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="О чем этот канал?"
              className="form-textarea"
              rows={3}
            />
          </div>

          <div className="create-channel-modal__actions">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Отмена
            </button>
            <button
              type="submit"
              disabled={!channelName.trim() || isCreating}
              className="btn btn-primary"
            >
              {isCreating ? "Создается..." : "Создать канал"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateChannelModal;
