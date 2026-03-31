import { bewtsSchema } from "@/app/schemas/bewtsSchema";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeUserInput } from "@/utils/normalize";
import { type NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "ログインが必要です" },
        { status: 401 },
      );
    }

    const userId = Number(session.user.id);
    const { publicId } = await params;

    const body = await req.json();
    const parsed = bewtsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "バリデーションエラー", details: parsed.error },
        { status: 400 },
      );
    }

    const data = parsed.data;

    const project = await prisma.bewtsProject.findUnique({
      where: { publicId },
      include: {
        roles: {
          select: {
            id: true,
            isLeader: true,
          },
        },
        rooms: {
          include: {
            role: {
              select: { id: true, isLeader: true },
            },
            members: {
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "プロジェクトが見つかりません" },
        { status: 404 },
      );
    }

    const isAdmin = Boolean(
      await prisma.bewtsPermission.findFirst({
        where: {
          projectId: project.id,
          userId,
          level: "ADMIN",
        },
        select: { id: true },
      }),
    );

    if (!isAdmin) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const foundSkills = await prisma.skill.findMany({
      where: { id: { in: data.skills } },
      select: { id: true },
    });
    if (foundSkills.length !== data.skills.length) {
      return NextResponse.json(
        { error: "存在しないスキルIDが含まれています" },
        { status: 400 },
      );
    }

    const allRoomMembers =
      project.rooms.find((room) => room.isAllRoom)?.members ?? [];
    const confirmedExcludingLeader = allRoomMembers.filter(
      (member) => member.userId !== project.leaderId,
    ).length;

    if (data.memberCount < confirmedExcludingLeader) {
      return NextResponse.json(
        {
          error: `募集人数は現在の参加人数(${confirmedExcludingLeader}人)未満にはできません`,
        },
        { status: 400 },
      );
    }

    const existingNonLeaderRoles = project.roles.filter(
      (role) => !role.isLeader,
    );
    const incomingRoleIds = new Set(
      data.roles
        .map((role) => role.roleId)
        .filter((roleId): roleId is number => typeof roleId === "number"),
    );

    const existingRoleIdSet = new Set(
      existingNonLeaderRoles.map((role) => role.id),
    );

    for (const roleId of incomingRoleIds) {
      if (!existingRoleIdSet.has(roleId)) {
        return NextResponse.json(
          { error: "不正な役割IDが含まれています" },
          { status: 400 },
        );
      }
    }

    const rolesToDelete = existingNonLeaderRoles.filter(
      (role) => !incomingRoleIds.has(role.id),
    );

    const roleRoomMemberCount = new Map<number, number>();
    for (const room of project.rooms) {
      if (room.isAllRoom || typeof room.roleId !== "number") continue;
      roleRoomMemberCount.set(room.roleId, room.members.length);
    }

    const assignedRole = rolesToDelete.find(
      (role) => (roleRoomMemberCount.get(role.id) ?? 0) > 0,
    );
    if (assignedRole) {
      return NextResponse.json(
        { error: "割り当て済みの役割は削除できません" },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.bewtsProject.update({
        where: { id: project.id },
        data: {
          name: normalizeUserInput(data.name),
          description: normalizeUserInput(data.description),
          maxMembers: data.memberCount,
          durationDays: data.durationDays,
        },
      });

      await tx.bewtsRole.updateMany({
        where: {
          projectId: project.id,
          isLeader: true,
        },
        data: { percentage: data.leaderSharePercentage },
      });

      await tx.bewtsSkill.deleteMany({ where: { projectId: project.id } });
      await tx.bewtsSkill.createMany({
        data: data.skills.map((skillId) => ({
          projectId: project.id,
          skillId,
        })),
      });

      for (const roleInput of data.roles) {
        if (typeof roleInput.roleId === "number") {
          await tx.bewtsRole.update({
            where: { id: roleInput.roleId },
            data: {
              name: normalizeUserInput(roleInput.name),
              percentage: roleInput.sharePercentage,
            },
          });
          continue;
        }

        const createdRole = await tx.bewtsRole.create({
          data: {
            projectId: project.id,
            name: normalizeUserInput(roleInput.name),
            percentage: roleInput.sharePercentage,
            isLeader: false,
          },
          select: { id: true, name: true },
        });

        await tx.bewtsRoom.create({
          data: {
            projectId: project.id,
            roleId: createdRole.id,
            isAllRoom: false,
            name: normalizeUserInput(createdRole.name),
          },
        });
      }

      const deleteRoleIds = rolesToDelete.map((role) => role.id);
      if (deleteRoleIds.length > 0) {
        await tx.bewtsRoom.deleteMany({
          where: {
            projectId: project.id,
            roleId: { in: deleteRoleIds },
          },
        });

        await tx.bewtsRole.deleteMany({
          where: {
            projectId: project.id,
            id: { in: deleteRoleIds },
          },
        });
      }
    });

    return NextResponse.json({ message: "プロジェクトを更新しました" });
  } catch (error) {
    console.error("Bewts update error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "プロジェクトの更新に失敗しました",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "ログインが必要です" },
        { status: 401 },
      );
    }

    const userId = Number(session.user.id);
    const { publicId } = await params;

    const project = await prisma.bewtsProject.findUnique({
      where: { publicId },
      select: {
        id: true,
        publicId: true,
        leaderId: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "プロジェクトが見つかりません" },
        { status: 404 },
      );
    }

    const isLeader = project.leaderId === userId;
    const isAdmin = Boolean(
      await prisma.bewtsPermission.findFirst({
        where: {
          projectId: project.id,
          userId,
          level: "ADMIN",
        },
        select: { id: true },
      }),
    );

    const canManageProject = Boolean(
      await prisma.bewtsPermissionCapability.findFirst({
        where: {
          projectId: project.id,
          userId,
          capability: { in: ["MANAGE_PROJECT", "GRANT_PERMISSION", "ADMIN"] },
        },
        select: { id: true },
      }),
    );

    if (!isLeader && !isAdmin && !canManageProject) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.app.updateMany({
        where: { bewtsProjectId: project.id },
        data: { bewtsProjectId: null },
      });

      await tx.bewtsProject.delete({
        where: { id: project.id },
      });
    });

    return NextResponse.json({
      message: "プロジェクトを削除しました",
      publicId: project.publicId,
    });
  } catch (error) {
    console.error("Bewts delete error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "プロジェクトの削除に失敗しました",
      },
      { status: 500 },
    );
  }
}
