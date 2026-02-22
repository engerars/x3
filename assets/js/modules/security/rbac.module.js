function normalizeRole(role) {
  return (role || "").toString().trim().toLowerCase();
}

function normalizeRoles(roles) {
  const list = Array.isArray(roles) ? roles : [];
  const normalized = list.map(normalizeRole).filter(Boolean);
  return [...new Set(normalized)];
}

function resolvePermissions(userRoles, rolePermissions, defaultPermissions = []) {
  const permissions = new Set(defaultPermissions || []);
  const normalizedRoles = normalizeRoles(userRoles);
  const matrix = rolePermissions || {};

  normalizedRoles.forEach((role) => {
    const grants = matrix[role] || matrix[role.toLowerCase()] || [];
    (grants || []).forEach((perm) => permissions.add(perm));
  });

  return [...permissions];
}

function hasAnyRequiredRole(userRoles, requiredRoles) {
  const required = normalizeRoles(requiredRoles);
  if (required.length === 0) return true;
  const owned = new Set(normalizeRoles(userRoles));
  return required.some((role) => owned.has(role));
}

function hasPermission(userPermissions, requiredPermission) {
  if (!requiredPermission) return true;
  const perms = new Set(userPermissions || []);
  return perms.has("*") || perms.has(requiredPermission);
}

export {
  normalizeRoles,
  resolvePermissions,
  hasAnyRequiredRole,
  hasPermission,
};
