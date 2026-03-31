import type {
  BewtsCapability,
  BewtsPermissionLevel,
} from "@/generated/prisma/enums";

export const CAPABILITY_OPTIONS: Array<{ id: BewtsCapability; name: string }> =
  [
    { id: "SCOUT", name: "スカウト権限" },
    { id: "PUBLISH", name: "ビューズ権限" },
    { id: "MANAGE_APP", name: "ビューズアプリ編集・削除" },
    { id: "VIEW_ALL_ROLES", name: "全役割チャット閲覧" },
    { id: "GRANT_PERMISSION", name: "権限付与" },
    { id: "ASSIGN_ROLE", name: "役割割当" },
    { id: "MANAGE_PROJECT", name: "プロジェクト編集・削除" },
    { id: "APPROVE_JOIN_REQUEST", name: "参加申請承認" },
    { id: "DECLINE_JOIN_REQUEST", name: "参加申請見送り" },
    { id: "UNDO_JOIN_APPROVAL", name: "承認取り消し" },
    { id: "INVITE_MEMBER", name: "メンバー招待" },
    { id: "MANAGE_GANTT", name: "ガント管理" },
    { id: "ADMIN", name: "管理者（フルアクセス）" },
  ];

export const MEMBER_DEFAULT_CAPABILITIES: BewtsCapability[] = ["SCOUT"];

export const PUBLISHER_EXTRA_CAPABILITIES: BewtsCapability[] = [
  "PUBLISH",
  "MANAGE_APP",
];

export const ADMIN_EXTRA_CAPABILITIES: BewtsCapability[] = [
  "ADMIN",
  "VIEW_ALL_ROLES",
  "GRANT_PERMISSION",
  "ASSIGN_ROLE",
  "MANAGE_PROJECT",
  "APPROVE_JOIN_REQUEST",
  "DECLINE_JOIN_REQUEST",
  "UNDO_JOIN_APPROVAL",
  "INVITE_MEMBER",
  "MANAGE_GANTT",
  "PUBLISH",
  "MANAGE_APP",
];

export function normalizeCapabilities(input: unknown): BewtsCapability[] {
  if (!Array.isArray(input)) {
    return [...MEMBER_DEFAULT_CAPABILITIES];
  }

  const allowed = new Set(CAPABILITY_OPTIONS.map((option) => option.id));
  const normalized = Array.from(
    new Set(
      input.filter(
        (value): value is BewtsCapability =>
          typeof value === "string" && allowed.has(value as BewtsCapability),
      ),
    ),
  );

  if (!normalized.includes("SCOUT")) {
    normalized.push("SCOUT");
  }

  const hasPublisherCapability =
    normalized.includes("PUBLISH") || normalized.includes("MANAGE_APP");
  if (hasPublisherCapability) {
    if (!normalized.includes("PUBLISH")) {
      normalized.push("PUBLISH");
    }
    if (!normalized.includes("MANAGE_APP")) {
      normalized.push("MANAGE_APP");
    }
  }

  if (normalized.includes("ADMIN")) {
    return CAPABILITY_OPTIONS.map((option) => option.id);
  }

  return normalized;
}

export function levelFromCapabilities(
  capabilities: BewtsCapability[],
): BewtsPermissionLevel {
  if (
    capabilities.includes("ADMIN") ||
    capabilities.includes("GRANT_PERMISSION") ||
    capabilities.includes("MANAGE_PROJECT") ||
    capabilities.includes("VIEW_ALL_ROLES")
  ) {
    return "ADMIN";
  }

  if (capabilities.includes("PUBLISH") || capabilities.includes("MANAGE_APP")) {
    return "PUBLISHER";
  }

  return "MEMBER";
}

export function defaultCapabilitiesByLevel(
  level: BewtsPermissionLevel,
): BewtsCapability[] {
  if (level === "ADMIN") {
    return normalizeCapabilities([
      ...MEMBER_DEFAULT_CAPABILITIES,
      ...PUBLISHER_EXTRA_CAPABILITIES,
      ...ADMIN_EXTRA_CAPABILITIES,
    ]);
  }

  if (level === "PUBLISHER") {
    return normalizeCapabilities([
      ...MEMBER_DEFAULT_CAPABILITIES,
      ...PUBLISHER_EXTRA_CAPABILITIES,
    ]);
  }

  return normalizeCapabilities(MEMBER_DEFAULT_CAPABILITIES);
}

export function hasCapability(
  capabilities: string[] | undefined,
  capability: BewtsCapability,
): boolean {
  return Boolean(capabilities?.includes(capability));
}
