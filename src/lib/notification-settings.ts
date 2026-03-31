import type { Prisma } from "@/generated/prisma/client";
import type { NotificationType } from "@/generated/prisma/enums";

const SETTING_KEY_BY_TYPE: Partial<
  Record<
    NotificationType,
    | "followEnabled"
    | "bewtEnabled"
    | "bewtsBewtEnabled"
    | "purchaseEnabled"
    | "chatEnabled"
    | "bewtsChatEnabled"
    | "orderEnabled"
    | "scoutEnabled"
    | "bewtsJoinRequestEnabled"
    | "bewtsJoinApprovedEnabled"
    | "bewtsJoinDeclinedEnabled"
    | "bewtsJoinFinalizedEnabled"
    | "bewtsJoinEnabled"
    | "systemEnabled"
  >
> = {
  FOLLOW: "followEnabled",
  PURCHASE: "purchaseEnabled",
  ORDER: "orderEnabled",
  SCOUT: "scoutEnabled",
  BEWTS_JOIN_REQUEST: "bewtsJoinRequestEnabled",
  BEWTS_JOIN_APPROVED: "bewtsJoinApprovedEnabled",
  BEWTS_JOIN_DECLINED: "bewtsJoinDeclinedEnabled",
};

type SettingKey =
  | "followEnabled"
  | "bewtEnabled"
  | "bewtsBewtEnabled"
  | "purchaseEnabled"
  | "chatEnabled"
  | "bewtsChatEnabled"
  | "orderEnabled"
  | "scoutEnabled"
  | "bewtsJoinRequestEnabled"
  | "bewtsJoinApprovedEnabled"
  | "bewtsJoinDeclinedEnabled"
  | "bewtsJoinFinalizedEnabled"
  | "bewtsJoinEnabled"
  | "systemEnabled";

type NotificationDbClient = {
  notification: {
    create: (args: {
      data: Prisma.NotificationUncheckedCreateInput;
    }) => Promise<unknown>;
    createMany: (args: {
      data: Prisma.NotificationCreateManyInput[];
    }) => Promise<unknown>;
  };
  notificationSetting: {
    findMany: (args: {
      where: Prisma.NotificationSettingWhereInput;
      select: { userId: true };
    }) => Promise<Array<{ userId: number }>>;
  };
};

async function getEnabledUserIds(
  db: NotificationDbClient,
  userIds: number[],
  settingKey: SettingKey | undefined,
): Promise<Set<number>> {
  if (!settingKey || userIds.length === 0) {
    return new Set(userIds);
  }

  const disabledRows = await db.notificationSetting.findMany({
    where: {
      userId: { in: userIds },
      [settingKey]: false,
    } as Prisma.NotificationSettingWhereInput,
    select: { userId: true },
  });

  const disabledSet = new Set(disabledRows.map((row) => row.userId));
  return new Set(userIds.filter((userId) => !disabledSet.has(userId)));
}

function resolveSettingKey(
  data:
    | Prisma.NotificationUncheckedCreateInput
    | Prisma.NotificationCreateManyInput,
): SettingKey | undefined {
  if (data.type === "CHAT") {
    return data.bewtsProjectId ? "bewtsChatEnabled" : "chatEnabled";
  }

  if (data.type === "BEWT") {
    return data.bewtsProjectId ? "bewtsBewtEnabled" : "bewtEnabled";
  }

  if (data.type === "SYSTEM") {
    if (data.joinRequestId && data.bewtsProjectId) {
      return "bewtsJoinFinalizedEnabled";
    }
    return "systemEnabled";
  }

  return SETTING_KEY_BY_TYPE[data.type] as SettingKey | undefined;
}

export async function createNotificationWithUserSetting(
  db: NotificationDbClient,
  data: Prisma.NotificationUncheckedCreateInput,
): Promise<void> {
  const settingKey = resolveSettingKey(data);
  const enabledUserIds = await getEnabledUserIds(db, [data.userId], settingKey);

  if (!enabledUserIds.has(data.userId)) {
    return;
  }

  await db.notification.create({ data });
}

export async function createNotificationsWithUserSetting(
  db: NotificationDbClient,
  dataList: Prisma.NotificationCreateManyInput[],
): Promise<void> {
  if (dataList.length === 0) {
    return;
  }

  const grouped = new Map<
    SettingKey | "__no_setting__",
    Prisma.NotificationCreateManyInput[]
  >();

  for (const data of dataList) {
    const settingKey = resolveSettingKey(data) ?? "__no_setting__";
    const current = grouped.get(settingKey) ?? [];
    current.push(data);
    grouped.set(settingKey, current);
  }

  const filteredData: Prisma.NotificationCreateManyInput[] = [];

  for (const [settingKey, items] of grouped) {
    const userIds = Array.from(new Set(items.map((item) => item.userId)));
    const enabledUserIds = await getEnabledUserIds(
      db,
      userIds,
      settingKey === "__no_setting__" ? undefined : settingKey,
    );

    filteredData.push(
      ...items.filter((item) => enabledUserIds.has(item.userId)),
    );
  }

  if (filteredData.length === 0) {
    return;
  }

  await db.notification.createMany({ data: filteredData });
}
