import type {
  BewtsCapability,
  NotificationType,
} from "@/generated/prisma/enums";

export type NotificationItem = {
  id: number;
  type: NotificationType;
  title: string;
  message: string | null;
  redirectUrl: string | null;
  isRead: boolean;
  createdAt: string;
  actor: {
    id: number;
    publicId: string;
    name: string;
    image: string | null;
  } | null;
  app: {
    publicId: string;
    name: string;
    appIconUrl: string | null;
  } | null;
  bewtsProject: {
    publicId: string;
    name: string;
    roles?: { id: number; name: string }[];
    viewerIsAdmin?: boolean;
    memberCount?: number;
    maxMembers?: number | null;
    totalMemberCount?: number;
    totalCapacity?: number | null;
  } | null;
  bewtsJoinRequest: {
    id: number;
    status: string;
    message: string | null;
    updatedAt?: string | null;
    roleId?: number | null;
    roleIds?: number[];
    capabilities?: BewtsCapability[];
    canUndo?: boolean;
  } | null;
};

export type NotificationSettings = {
  followEnabled: boolean;
  bewtEnabled: boolean;
  bewtsBewtEnabled: boolean;
  purchaseEnabled: boolean;
  chatEnabled: boolean;
  bewtsChatEnabled: boolean;
  orderEnabled: boolean;
  scoutEnabled: boolean;
  bewtsJoinRequestEnabled: boolean;
  bewtsJoinApprovedEnabled: boolean;
  bewtsJoinDeclinedEnabled: boolean;
  bewtsJoinFinalizedEnabled: boolean;
  bewtsJoinEnabled: boolean;
  systemEnabled: boolean;
};

export type ConfirmNotificationState = {
  notificationId?: number;
  requestId: number;
  action: "approve" | "decline" | "undo";
  roleId?: number | null;
  roleIds?: number[];
  capabilities?: BewtsCapability[];
  userName: string;
  userImage: string | null;
};
