import { auth } from "@/lib/auth";
import {
  defaultCapabilitiesByLevel,
  levelFromCapabilities,
  normalizeCapabilities,
} from "@/lib/bewtsCapabilities";
import { createNotificationWithUserSetting } from "@/lib/notification-settings";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import BewtsDetailClient from "./BewtsDetailClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  if (!publicId || typeof publicId !== "string") notFound();

  const project = await prisma.bewtsProject.findUnique({
    where: { publicId },
    select: { name: true },
  });

  if (!project) {
    notFound();
  }
  return {
    title: `ビューズプロジェクト - ${project.name}`,
  };
}

type RoleMember = {
  id: number;
  name: string;
  image: string | null;
  isOwner?: boolean;
};

type Role = {
  id: number;
  name: string;
  isLeader: boolean;
  percentage: number;
  members: RoleMember[];
};

export type BewtsDetail = {
  id: number;
  publicId: string;
  name: string;
  description: string;
  status: string;
  leader: { id: number; name: string; image: string | null } | null;
  skills: string[];
  progress: number | null;
  // tasks derived from the room.ganttChart.tasks
  tasks: { id: number; name: string; progress: number }[];
  roles: Role[];
  members: {
    id: number;
    name: string;
    image: string | null;
    isOwner?: boolean;
  }[];
  isJoined?: boolean;
  isLeader?: boolean;
  userRoleName?: string | null;
  // memberCount は募集人数に対する埋まり（リーダー除く）
  memberCount: number;
  maxMembers?: number | null;
  // 総員（リーダー含む現在の人数）と総キャパシティ（leader + maxMembers）
  totalMemberCount?: number;
  totalCapacity?: number | null;
  // サーバー側で判定した "既に申請済みか" フラグ
  hasApplied?: boolean;
  // 権限フラグ（ビューズからの共同出品などで利用）
  isAdmin?: boolean;
  isPublisher?: boolean;
  joinRequests?: {
    id: number;
    message: string | null;
    createdAt: string;
    status?: "PENDING" | "APPROVED" | "DECLINED";
    updatedAt?: string;
    roleIds?: number[];
    roleNames?: string[];
    roleId?: number | null;
    user: {
      publicId: string;
      name: string;
      image: string | null;
    };
  }[];
};

async function getProject(publicId: string, myId: number | null) {
  let p = await prisma.bewtsProject.findUnique({
    where: { publicId },
    include: {
      leader: { select: { id: true, name: true, image: true } },
      skills: { include: { skill: true } },
      roles: true,
      rooms: {
        include: {
          members: { include: { user: true } },
          ganttChart: { include: { tasks: true } },
        },
      },
      permissions: true,
      bewtsPermissionCapabilities: {
        select: {
          userId: true,
          capability: true,
        },
      },
      joinRequests: {
        where: { status: "PENDING" },
        include: {
          roleAssignments: {
            include: {
              role: { select: { id: true, name: true } },
            },
          },
          user: {
            select: { publicId: true, name: true, image: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!p) return null;

  // finalize: Undo ウィンドウ経過の承認はここで確定させる（ページ読み込み時のオンデマンド実行）
  // NOTE: inlined finalizer logic (removed dependency on external module)
  const UNDO_WINDOW_MS = 1 * 60 * 1000;
  const cutoff = new Date(Date.now() - UNDO_WINDOW_MS);

  // snapshot p to a local const so TS knows it's non-null across awaits
  const project = p;
  if (!project) return null;

  const approvedCandidates = await prisma.bewtsJoinRequest.findMany({
    where: {
      projectId: project.id,
      status: "APPROVED",
      updatedAt: { lt: cutoff },
    },
    select: {
      id: true,
      userId: true,
      roleId: true,
      projectId: true,
      capabilityAssignments: {
        select: { capability: true },
      },
      roleAssignments: {
        select: { roleId: true },
      },
    },
  });

  for (const jr of approvedCandidates) {
    const existing = await prisma.bewtsPermission.findFirst({
      where: { projectId: jr.projectId, userId: jr.userId },
    });
    if (existing) continue;

    await prisma.$transaction(async (tx) => {
      const allRoom = project.rooms.find((r) => r.isAllRoom);
      if (allRoom) {
        await tx.bewtsRoomMember.createMany({
          data: [{ roomId: allRoom.id, userId: jr.userId }],
          skipDuplicates: true,
        });
      }

      const assignedCapabilities = normalizeCapabilities(
        jr.capabilityAssignments.length > 0
          ? jr.capabilityAssignments.map((assignment) => assignment.capability)
          : defaultCapabilitiesByLevel("MEMBER"),
      );

      await tx.bewtsPermission.create({
        data: {
          projectId: jr.projectId,
          userId: jr.userId,
          level: levelFromCapabilities(assignedCapabilities),
        },
      });

      await tx.bewtsPermissionCapability.createMany({
        data: assignedCapabilities.map((capability) => ({
          projectId: jr.projectId,
          userId: jr.userId,
          capability,
        })),
        skipDuplicates: true,
      });

      const assignedRoleIds =
        jr.roleAssignments.length > 0
          ? jr.roleAssignments.map((assignment) => assignment.roleId)
          : jr.roleId
            ? [jr.roleId]
            : [];

      if (assignedRoleIds.length > 0) {
        const roleRoomIds = project.rooms
          .filter(
            (room): room is typeof room & { roleId: number } =>
              typeof room.roleId === "number" &&
              assignedRoleIds.includes(room.roleId),
          )
          .map((room) => room.id);

        if (roleRoomIds.length > 0) {
          await tx.bewtsRoomMember.createMany({
            data: roleRoomIds.map((roomId) => ({ roomId, userId: jr.userId })),
            skipDuplicates: true,
          });
        }
      }

      await createNotificationWithUserSetting(tx, {
        userId: jr.userId,
        actorId: null,
        type: "SYSTEM",
        title: `「${project.name}」への参加が確定しました`,
        message: `承認の取り消し期間が過ぎました。プロジェクトに正式に参加しました。`,
        redirectUrl: `/bewts/${project.publicId}`,
        bewtsProjectId: jr.projectId,
        joinRequestId: jr.id,
      });
    });
  }

  // 再取得して members/permissions の確定後の状態を反映する
  p = await prisma.bewtsProject.findUnique({
    where: { publicId },
    include: {
      leader: { select: { id: true, name: true, image: true } },
      skills: { include: { skill: true } },
      roles: true,
      rooms: {
        include: {
          members: { include: { user: true } },
          ganttChart: { include: { tasks: true } },
        },
      },
      permissions: true,
      bewtsPermissionCapabilities: {
        select: {
          userId: true,
          capability: true,
        },
      },
      // include pending requests and recent APPROVED/DECLINED within the undo window
      joinRequests: {
        where: {
          OR: [
            { status: "PENDING" },
            {
              status: { in: ["APPROVED", "DECLINED"] },
              updatedAt: { gte: cutoff },
            },
          ],
        },
        include: {
          roleAssignments: {
            include: {
              role: { select: { id: true, name: true } },
            },
          },
          user: {
            select: { publicId: true, name: true, image: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!p) return null;

  const allRoom = p.rooms.find((r) => r.isAllRoom);
  const rawMembers = allRoom?.members ?? [];

  const tasks = (allRoom?.ganttChart?.tasks ?? []) as {
    id: number;
    name: string;
    progress: number;
    displayOrder?: number | null;
  }[];

  const validTasks = tasks.filter((t) => typeof t.progress === "number");
  let ganttProgress: number | null = null;
  if (validTasks.length > 0) {
    const avg = Math.round(
      validTasks.reduce((s: number, t) => s + (t.progress ?? 0), 0) /
        validTasks.length,
    );
    ganttProgress = Math.max(0, Math.min(100, avg));
  }

  const serializedTasks = tasks
    .slice()
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    .map((t) => ({ id: t.id, name: t.name, progress: t.progress }));

  const roleRoomMembersMap = new Map<number, typeof rawMembers>();
  for (const room of p.rooms) {
    if (room.isAllRoom || typeof room.roleId !== "number") continue;
    roleRoomMembersMap.set(room.roleId, room.members);
  }

  const roles = p.roles.map((r) => {
    const members = (roleRoomMembersMap.get(r.id) ?? []).map((member) => ({
      id: member.user.id,
      name:
        myId && member.user.id === myId ? "あなた" : (member.user.name ?? "—"),
      image: member.user.image ?? null,
      isOwner: member.user.id === p.leaderId,
    }));

    return {
      id: r.id,
      name: r.name,
      isLeader: r.isLeader,
      percentage: r.percentage,
      members,
    };
  });

  const members = rawMembers.map((m) => ({
    id: m.user.id,
    name: myId && m.user.id === myId ? "あなた" : (m.user.name ?? "—"),
    image: m.user.image ?? null,
    isOwner: m.user.id === p.leaderId,
  }));

  const isJoined = Boolean(
    myId && p.permissions.some((pp) => pp.userId === myId),
  );
  const isLeader = Boolean(myId && p.leaderId === myId);
  const myCapabilities =
    myId == null
      ? []
      : p.bewtsPermissionCapabilities
          .filter((cap) => cap.userId === myId)
          .map((cap) => cap.capability);
  const isAdmin = Boolean(
    myId &&
      (myCapabilities.includes("ADMIN") ||
        myCapabilities.includes("GRANT_PERMISSION") ||
        myCapabilities.includes("MANAGE_PROJECT") ||
        p.permissions.some((pp) => pp.userId === myId && pp.level === "ADMIN")),
  );
  const isPublisher = Boolean(
    myId &&
      (myCapabilities.includes("PUBLISH") ||
        myCapabilities.includes("MANAGE_APP") ||
        p.permissions.some(
          (pp) => pp.userId === myId && pp.level === "PUBLISHER",
        )),
  );
  const userRole =
    myId == null
      ? null
      : p.roles.find((role) => {
          const members = roleRoomMembersMap.get(role.id) ?? [];
          return members.some((member) => member.userId === myId);
        });

  const serializedJoinRequests = p.joinRequests.map((req) => ({
    id: req.id,
    message: req.message,
    createdAt: req.createdAt.toISOString(),
    status: req.status,
    updatedAt: req.updatedAt.toISOString(),
    roleIds: req.roleAssignments.map((assignment) => assignment.roleId),
    roleNames: req.roleAssignments.map((assignment) => assignment.role.name),
    roleId: req.roleId ?? null,
    user: {
      publicId: req.user.publicId,
      name: myId && req.userId === myId ? "あなた" : (req.user.name ?? "—"),
      image: req.user.image,
    },
  }));

  // サーバー側で "既に申請済み" の有無を判定して返す（リロードしてもボタンが戻らないように）
  const hasApplied = myId
    ? Boolean(
        await prisma.bewtsJoinRequest.findFirst({
          where: { projectId: p.id, userId: myId },
          select: { id: true },
        }),
      )
    : false;

  return {
    id: p.id,
    publicId: p.publicId,
    name: p.name,
    description: p.description,
    status: p.status,
    leader: p.leader
      ? {
          id: p.leader.id,
          name:
            myId && p.leader.id === myId ? "あなた" : (p.leader.name ?? "—"),
          image: p.leader.image ?? null,
        }
      : null,
    skills: p.skills.map((s) => s.skill.name),
    progress: ganttProgress,
    tasks: serializedTasks,
    // memberCount は "募集人数に対する現在の埋まり"（リーダーを除く）
    memberCount: rawMembers.filter((m) => m.user.id !== p.leaderId).length,
    // 募集枠（リーダーを含まない）
    maxMembers: p.maxMembers,
    // 総員（リーダーを含む現在の人数）と総キャパシティ（リーダー＋募集人数）
    totalMemberCount:
      rawMembers.filter((m) => m.user.id !== p.leaderId).length +
      (p.leaderId ? 1 : 0),
    totalCapacity: typeof p.maxMembers === "number" ? p.maxMembers + 1 : null,
    roles,
    isJoined,
    isLeader,
    isAdmin,
    isPublisher,
    userRoleName: userRole?.name ?? null,
    members,
    hasApplied,
    joinRequests: isLeader || isAdmin ? serializedJoinRequests : [],
  } as BewtsDetail;
}

export default async function BewtsDetailPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  if (!publicId || typeof publicId !== "string") notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  const myId = session?.user?.id ? Number(session.user.id) : null;

  const project = await getProject(publicId, myId);
  if (!project) notFound();

  return <BewtsDetailClient project={project} />;
}
