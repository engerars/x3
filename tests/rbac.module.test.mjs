import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeRoles,
  resolvePermissions,
  hasAnyRequiredRole,
  hasPermission,
} from "../assets/js/modules/security/rbac.module.js";

test("normalizeRoles trims, lowercases and deduplicates", () => {
  const roles = normalizeRoles([" X3.Admin ", "x3.ADMIN", "x3.viewer", "", null]);
  assert.deepEqual(roles, ["x3.admin", "x3.viewer"]);
});

test("resolvePermissions merges role matrix with default permissions", () => {
  const perms = resolvePermissions(
    ["x3.editor"],
    {
      "x3.editor": ["data.write", "import.execute"],
    },
    ["data.read"]
  );
  assert.ok(perms.includes("data.read"));
  assert.ok(perms.includes("data.write"));
  assert.ok(perms.includes("import.execute"));
});

test("hasAnyRequiredRole works with normalized role names", () => {
  assert.equal(hasAnyRequiredRole(["X3.Admin"], ["x3.admin"]), true);
  assert.equal(hasAnyRequiredRole(["x3.viewer"], ["x3.admin", "x3.editor"]), false);
});

test("hasPermission honors wildcard and specific permissions", () => {
  assert.equal(hasPermission(["*"], "admin.maintenance"), true);
  assert.equal(hasPermission(["data.read"], "data.read"), true);
  assert.equal(hasPermission(["data.read"], "data.write"), false);
});
