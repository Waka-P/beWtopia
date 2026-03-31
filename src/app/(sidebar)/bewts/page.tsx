import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { headers } from "next/headers";
import NewBewtsButton from "./NewBewtsButton";
import ProjectsList from "./ProjectsList";

export const metadata: Metadata = {
  title: "ビューズ - プロジェクト一覧",
};

export default async function BewtsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const myId = session?.user?.id ? parseInt(session.user.id, 10) : null;

  const projects = await prisma.bewtsProject.findMany({
    where: myId
      ? {
          NOT: { permissions: { some: { userId: myId } } },
        }
      : {},
    include: {
      leader: { select: { id: true, name: true, image: true } },
      skills: { include: { skill: true } },
      // include roles so the list page can offer role selection on apply
      roles: { select: { id: true, name: true, isLeader: true } },
      rooms: {
        select: {
          roleId: true,
          isAllRoom: true,
          members: {
            select: {
              userId: true,
              joinedAt: true,
              user: { select: { id: true, name: true, image: true } },
            },
          },
          ganttChart: { include: { tasks: true } },
        },
      },
      // ログインユーザーが既に申請済みかどうかを判定するための joinRequests
      joinRequests: myId
        ? {
            where: { userId: myId },
            select: { id: true },
          }
        : false,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const serialized = projects.map((p) => {
    // derive progress from Gantt chart tasks when available
    const room = p.rooms.find((r) => r.isAllRoom);
    const tasks = (room?.ganttChart?.tasks ?? []) as {
      progress?: number | null;
    }[];
    let ganttProgress: number | null = null;
    const validTasks = tasks.filter((t) => typeof t.progress === "number");
    if (validTasks.length > 0) {
      const avg = Math.round(
        validTasks.reduce((s: number, t) => s + (t.progress ?? 0), 0) /
          validTasks.length,
      );
      ganttProgress = Math.max(0, Math.min(100, avg));
    }

    const rawMembers = room?.members ?? [];
    const members = rawMembers
      .filter((m) => m.userId !== p.leader?.id)
      .map((m) => ({
        id: m.userId,
        name: myId && m.userId === myId ? "あなた" : (m.user?.name ?? "—"),
        image: m.user?.image ?? null,
        joinedAt: m.joinedAt?.toISOString?.() ?? null,
      }));

    const confirmedExcludingLeader = rawMembers.filter(
      (m) => m.userId !== p.leader?.id,
    ).length;

    return {
      id: p.id,
      publicId: p.publicId,
      name: p.name,
      description: p.description,
      // memberCount は募集に関する埋まり（リーダーを含まない）
      memberCount: confirmedExcludingLeader,
      maxMembers: p.maxMembers,
      // 総員（リーダーを含む現在の人数）と総キャパシティ
      totalMemberCount: confirmedExcludingLeader + (p.leader ? 1 : 0),
      totalCapacity: typeof p.maxMembers === "number" ? p.maxMembers + 1 : null,
      skills: p.skills.map((s) => s.skill.name),
      leaderName:
        myId && p.leader?.id === myId ? "あなた" : (p.leader?.name ?? null),
      leaderImage: p.leader?.image ?? null,
      createdAt: p.createdAt.toISOString(),
      durationDays: p.durationDays,
      progress: ganttProgress,
      status: p.status,
      members,
      // roles available for applicants to request（リーダー役割は除外）
      availableRoles:
        p.roles
          ?.filter((r) => !r.isLeader)
          .map((r) => ({
            id: r.id,
            name: r.name,
          })) ?? [],
      // 一覧側でも「申請済み」を表示するためのフラグ
      hasApplied: myId
        ? Array.isArray(p.joinRequests)
          ? p.joinRequests.length > 0
          : false
        : false,
    };
  });

  const visible = serialized.filter(
    (p) => typeof p.maxMembers !== "number" || p.memberCount < p.maxMembers,
  );
  return (
    <>
      <NewBewtsButton current="open" />
      <ProjectsList projects={visible} isJoined={false} />
    </>
  );
}
