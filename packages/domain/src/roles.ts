export const ROLES = ["ARTESAO", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | "jobs:write"
  | "jobs:read"
  | "finance:record"
  | "quotes:draft"
  | "quotes:request_pdf"
  | "quotes:approve"
  | "quotes:approve_below_floor"
  | "settings:write"
  | "catalog:write"
  | "inventory:write"
  | "duplicates:merge"
  | "audit:read"
  | "reports:read";

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ARTESAO: ["jobs:write", "jobs:read", "finance:record", "quotes:draft", "quotes:request_pdf"],
  ADMIN: [
    "jobs:write",
    "jobs:read",
    "finance:record",
    "quotes:draft",
    "quotes:request_pdf",
    "quotes:approve",
    "quotes:approve_below_floor",
    "settings:write",
    "catalog:write",
    "inventory:write",
    "duplicates:merge",
    "audit:read",
    "reports:read",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
