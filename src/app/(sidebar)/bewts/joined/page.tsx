import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { headers } from "next/headers";
import NewBewtsButton from "../NewBewtsButton";
import ProjectsList from "../ProjectsList";

export const metadata: Metadata = {
  title: "ビューズ - 参加中のプロジェクト一覧",
};

export default async function JoinedBewts() {
  const session = await auth.api.getSession({ headers: await headers() });
  const myId = session?.user?.id ? parseInt(session.user.id, 10) : null;

  if (!myId) {
    return (
      <div style={{ padding: 40, color: "#e8faff" }}>
        <h2>ログインしてください</h2>
      </div>
    );
  }

  const projects = await prisma.bewtsProject.findMany({
    where: { permissions: { some: { userId: myId } } },
    include: {
      leader: { select: { id: true, name: true, image: true } },
      skills: { include: { skill: true } },
      rooms: {
        include: {
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
      roles: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const serialized = projects.map((p) => {
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
    const confirmedExcludingLeader = rawMembers.filter(
      (m) => m.userId !== p.leader?.id,
    ).length;

    const members = rawMembers
      .filter((m) => m.userId !== p.leader?.id)
      .map((m) => ({
        id: m.userId,
        name: myId && m.userId === myId ? "あなた" : (m.user?.name ?? "—"),
        image: m.user?.image ?? null,
        joinedAt: m.joinedAt?.toISOString?.() ?? null,
      }));

    const roleRoomMemberMap = new Map<number, number[]>();
    for (const projectRoom of p.rooms) {
      if (projectRoom.isAllRoom || typeof projectRoom.roleId !== "number") {
        continue;
      }
      roleRoomMemberMap.set(
        projectRoom.roleId,
        projectRoom.members.map((member) => member.userId),
      );
    }
    const userRoleNames = p.roles
      .filter((role) => (roleRoomMemberMap.get(role.id) ?? []).includes(myId))
      .map((role) => role.name);

    return {
      id: p.id,
      publicId: p.publicId,
      name: p.name,
      description: p.description,
      // 募集側の埋まり（リーダーを除く）
      memberCount: confirmedExcludingLeader,
      maxMembers: p.maxMembers,
      // 総員（leader を含む）と総キャパシティ
      totalMemberCount: confirmedExcludingLeader + (p.leader ? 1 : 0),
      totalCapacity: typeof p.maxMembers === "number" ? p.maxMembers + 1 : null,
      skills: p.skills.map((s) => s.skill.name),
      leaderName:
        myId && p.leader?.id === myId ? "あなた" : (p.leader?.name ?? null),
      leaderImage: p.leader?.image ?? null,
      createdAt: p.createdAt.toISOString(),
      durationDays: p.durationDays,
      userRoleName: userRoleNames[0] ?? null,
      userRoleNames,
      progress: ganttProgress,
      status: p.status,
      members,
    };
  });

  return (
    <>
      <NewBewtsButton current="joined" />
      <ProjectsList projects={serialized} isJoined={true} />
    </>
  );
}
