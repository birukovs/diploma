/**
 * Check if a user is a system/technical user that should be hidden from UI.
 * Examples: recording-egress-*, RECORDING-EGRESS-UUID, etc.
 *
 * @param {Object} user - User object with id, name, role properties
 * @returns {boolean} - true if user should be hidden
 */
export function isSystemUser(user) {
  if (!user) return false;

  const userId = (user.id || "").toLowerCase();
  const userName = (user.name || "").toLowerCase();
  const userRole = (user.role || "").toLowerCase();

  // Check user ID patterns
  if (userId.startsWith("recording")) return true;
  if (userId.includes("egress")) return true;

  // Check user name patterns
  if (userName.includes("recording")) return true;

  // Check role
  if (userRole === "system") return true;

  return false;
}

/**
 * Filter out system users from an array of users
 * @param {Array} users - Array of user objects
 * @returns {Array} - Filtered array without system users
 */
export function filterSystemUsers(users) {
  if (!Array.isArray(users)) return [];
  return users.filter(user => !isSystemUser(user));
}

/**
 * Filter out reactions from system users
 * @param {Array} reactions - Array of reaction objects with user property
 * @returns {Array} - Filtered array without system user reactions
 */
export function filterSystemUserReactions(reactions) {
  if (!Array.isArray(reactions)) return [];
  return reactions.filter(reaction => !isSystemUser(reaction.user));
}
