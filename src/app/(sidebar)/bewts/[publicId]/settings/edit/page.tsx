import { BewtsForm } from "@/app/(sidebar)/bewts/BewtsForm";
import type { BewtsFormData } from "@/app/schemas/bewtsSchema";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import styles from "../Settings.module.scss";

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

  if (!project) notFound();

  return {
    title: `プロジェクト編集 - ${project.name}`,
  };
}

export default async function BewtsSettingsEditPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    redirect("/login");
  }

  const viewerId = Number(session.user.id);
  const { publicId } = await params;

  const project = await prisma.bewtsProject.findUnique({
    where: { publicId },
    include: {
      skills: {
        include: {
          skill: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      roles: {
        select: {
          id: true,
          name: true,
          percentage: true,
          isLeader: true,
        },
        orderBy: [{ isLeader: "desc" }, { id: "asc" }],
      },
      rooms: {
        select: {
          id: true,
          isAllRoom: true,
          roleId: true,
          members: {
            select: { userId: true },
          },
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const viewerCanManageProject = Boolean(
    await prisma.bewtsPermissionCapability.findFirst({
      where: {
        projectId: project.id,
        userId: viewerId,
        capability: "MANAGE_PROJECT",
      },
      select: { id: true },
    }),
  );

  const viewerIsLevelAdmin = Boolean(
    await prisma.bewtsPermission.findFirst({
      where: {
        projectId: project.id,
        userId: viewerId,
        level: "ADMIN",
      },
      select: { id: true },
    }),
  );

  if (!viewerCanManageProject && !viewerIsLevelAdmin) {
    notFound();
  }

  const leaderRole = project.roles.find((role) => role.isLeader);
  const editableRoles = project.roles.filter((role) => !role.isLeader);
  const roleMemberCountMap = new Map<number, number>();
  for (const room of project.rooms) {
    if (room.isAllRoom || typeof room.roleId !== "number") continue;
    roleMemberCountMap.set(room.roleId, room.members.length);
  }
  const lockedRoleIds = editableRoles
    .filter((role) => (roleMemberCountMap.get(role.id) ?? 0) > 0)
    .map((role) => role.id);

  const allRoomMembers =
    project.rooms.find((room) => room.isAllRoom)?.members ?? [];
  const confirmedExcludingLeader = allRoomMembers.filter(
    (member) => member.userId !== project.leaderId,
  ).length;

  const skills = await prisma.skill.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const initialFormData: Partial<BewtsFormData> = {
    name: project.name,
    description: project.description,
    skills: project.skills.map((projectSkill) => projectSkill.skill.id),
    memberCount: project.maxMembers,
    durationDays: project.durationDays ?? 30,
    leaderSharePercentage: leaderRole?.percentage ?? 20,
    roles: editableRoles.map((role) => ({
      roleId: role.id,
      name: role.name,
      sharePercentage: role.percentage,
    })),
    status: project.status,
  };

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <Link
          href={`/bewts/${project.publicId}/settings`}
          className={styles.trail}
        >
          <span className={styles.trailArrow}>&#9664;</span>
          設定メニューへ戻る
        </Link>
      </div>

      <section className={styles.section}>
        <h1 className={styles.title}>プロジェクト編集</h1>
        <p className={styles.hint}>
          募集人数は現在参加中メンバー数（{confirmedExcludingLeader}
          人）未満にできません。割り当て済み役割は削除できません。
        </p>
      </section>

      <BewtsForm
        skills={skills}
        mode="edit"
        projectPublicId={project.publicId}
        initialValues={initialFormData}
        minMemberCount={confirmedExcludingLeader}
        lockedRoleIds={lockedRoleIds}
      />
    </div>
  );
}
