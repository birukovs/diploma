/**
 * Проверяет, является ли пользователь системным/техническим и должен ли скрываться в UI.
 * Примеры: recording-egress-*, RECORDING-EGRESS-UUID и т.д.
 *
 * @param {Object} user - Объект пользователя с полями id, name, role
 * @returns {boolean} - true, если пользователя нужно скрыть
 */
export function isSystemUser(user) {
  if (!user) return false;

  const userId = (user.id || "").toLowerCase();
  const userName = (user.name || "").toLowerCase();
  const userRole = (user.role || "").toLowerCase();

  // Проверка шаблонов ID пользователя
  if (userId.startsWith("recording")) return true;
  if (userId.includes("egress")) return true;

  // Проверка шаблонов имени пользователя
  if (userName.includes("recording")) return true;

  // Проверка роли
  if (userRole === "system") return true;

  return false;
}

/**
 * Фильтрует системных пользователей из массива пользователей
 * @param {Array} users - Массив объектов пользователей
 * @returns {Array} - Отфильтрованный массив без системных пользователей
 */
export function filterSystemUsers(users) {
  if (!Array.isArray(users)) return [];
  return users.filter(user => !isSystemUser(user));
}

/**
 * Фильтрует реакции от системных пользователей
 * @param {Array} reactions - Массив объектов реакций с полем user
 * @returns {Array} - Отфильтрованный массив без реакций системных пользователей
 */
export function filterSystemUserReactions(reactions) {
  if (!Array.isArray(reactions)) return [];
  return reactions.filter(reaction => !isSystemUser(reaction.user));
}
