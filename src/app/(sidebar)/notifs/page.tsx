import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import NotificationsClient from "./NotificationsClient";
import type { NotificationSettings } from "./types";

export const metadata: Metadata = {
  title: "通知",
};

async function getNotifications(userId: number) {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    include: {
      actor: {
        select: {
          id: true,
          publicId: true,
          name: true,
          image: true,
        },
      },
      app: {
        select: {
          publicId: true,
          name: true,
          appIconUrl: true,
        },
      },
      bewtsProject: {
        select: {
          id: true,
          publicId: true,
          name: true,
          leader: { select: { id: true } },
          maxMembers: true,
          roles: { select: { id: true, name: true, isLeader: true } },
          // all-room のメンバーを取って memberCount を算出する
          rooms: {
            where: { isAllRoom: true },
            select: { members: { select: { id: true } } },
          },
        },
      },
      bewtsJoinRequest: {
        select: {
          id: true,
          status: true,
          message: true,
          updatedAt: true,
          roleId: true,
          roleAssignments: {
            select: { roleId: true },
          },
          capabilityAssignments: {
            select: { capability: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // admin 判定: 通知に含まれるプロジェクト群のうち、現在ユーザーが ADMIN 権限を持つプロジェクトを先に取得
  const projectIds = Array.from(
    new Set(
      notifications
        .map((n) => (n.bewtsProject ? n.bewtsProject.id : null))
        .filter(Boolean) as number[],
    ),
  );

  const adminRows =
    projectIds.length > 0
      ? await prisma.bewtsPermission.findMany({
          where: {
            projectId: { in: projectIds },
            userId,
            OR: [{ level: "ADMIN" }],
          },
          select: { projectId: true },
        })
      : [];

  const adminCapabilityRows =
    projectIds.length > 0
      ? await prisma.bewtsPermissionCapability.findMany({
          where: {
            projectId: { in: projectIds },
            userId,
            capability: "GRANT_PERMISSION",
          },
          select: { projectId: true },
        })
      : [];
  const adminProjectIds = new Set([
    ...adminRows.map((r) => r.projectId),
    ...adminCapabilityRows.map((r) => r.projectId),
  ]);

  return notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    redirectUrl: n.redirectUrl,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
    actor: n.actor
      ? {
          id: n.actor.id,
          publicId: n.actor.publicId,
          name: n.actor.name,
          image: n.actor.image,
        }
      : null,
    app: n.app
      ? {
          publicId: n.app.publicId,
          name: n.app.name,
          appIconUrl: n.app.appIconUrl,
        }
      : null,
    bewtsProject: n.bewtsProject
      ? (() => {
          const bp = n.bewtsProject as NonNullable<typeof n.bewtsProject>;
          const leaderId = bp.leader?.id ?? null;
          const members = bp.rooms?.[0]?.members ?? [];
          const memberCount = members.filter((m) => m.id !== leaderId).length;

          const roles = (bp.roles ?? [])
            .filter((r) => !r.isLeader)
            .map((r) => ({
              id: r.id,
              name: r.name,
            }));
          return {
            publicId: bp.publicId,
            name: bp.name,
            roles,
            // 募集側の埋まり（リーダー除く）
            memberCount,
            maxMembers: bp.maxMembers ?? null,
            // 総員（リーダー含む現在の人数）と総キャパシティ
            totalMemberCount: memberCount + (bp.leader ? 1 : 0),
            totalCapacity:
              typeof bp.maxMembers === "number" ? bp.maxMembers + 1 : null,
            // viewer がそのプロジェクトで ADMIN かどうか
            viewerIsAdmin: adminProjectIds.has(bp.id),
          };
        })()
      : null,
    bewtsJoinRequest: n.bewtsJoinRequest
      ? {
          id: n.bewtsJoinRequest.id,
          status: n.bewtsJoinRequest.status,
          message: n.bewtsJoinRequest.message,
          updatedAt: n.bewtsJoinRequest.updatedAt?.toISOString?.() ?? null,
          canUndo:
            n.bewtsJoinRequest.status !== "PENDING" &&
            Date.now() - new Date(n.bewtsJoinRequest.updatedAt).getTime() <=
              1 * 60 * 1000,
          roleId: n.bewtsJoinRequest.roleId ?? null,
          roleIds: n.bewtsJoinRequest.roleAssignments.map((r) => r.roleId),
          capabilities: n.bewtsJoinRequest.capabilityAssignments.map(
            (cap) => cap.capability,
          ),
        }
      : null,
  }));
}

async function getNotificationSettings(
  userId: number,
): Promise<NotificationSettings> {
  const defaults: NotificationSettings = {
    followEnabled: true,
    bewtEnabled: true,
    bewtsBewtEnabled: true,
    purchaseEnabled: true,
    chatEnabled: true,
    bewtsChatEnabled: true,
    orderEnabled: true,
    scoutEnabled: true,
    bewtsJoinRequestEnabled: true,
    bewtsJoinApprovedEnabled: true,
    bewtsJoinDeclinedEnabled: true,
    bewtsJoinFinalizedEnabled: true,
    bewtsJoinEnabled: true,
    systemEnabled: true,
  };

  try {
    let settings = await prisma.notificationSetting.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await prisma.notificationSetting.create({
        data: { userId },
      });
    }

    return {
      followEnabled: settings.followEnabled,
      bewtEnabled: settings.bewtEnabled,
      bewtsBewtEnabled: settings.bewtsBewtEnabled,
      purchaseEnabled: settings.purchaseEnabled,
      chatEnabled: settings.chatEnabled,
      bewtsChatEnabled: settings.bewtsChatEnabled,
      orderEnabled: settings.orderEnabled,
      scoutEnabled: settings.scoutEnabled,
      bewtsJoinRequestEnabled: settings.bewtsJoinRequestEnabled,
      bewtsJoinApprovedEnabled: settings.bewtsJoinApprovedEnabled,
      bewtsJoinDeclinedEnabled: settings.bewtsJoinDeclinedEnabled,
      bewtsJoinFinalizedEnabled: settings.bewtsJoinFinalizedEnabled,
      bewtsJoinEnabled: settings.bewtsJoinEnabled,
      systemEnabled: settings.systemEnabled,
    };
  } catch {
    return defaults;
  }
}

export default async function NotificationsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(session.user.id) },
    select: { id: true },
  });

  if (!user) {
    return notFound();
  }

  const notifications = await getNotifications(user.id);
  const initialNotificationSettings = await getNotificationSettings(user.id);

  return (
    <NotificationsClient
      notifications={notifications}
      initialNotificationSettings={initialNotificationSettings}
    />
  );
}
