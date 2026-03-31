import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const payloadSchema = z.object({
  userId: z.number().int().positive(),
  roleIds: z.array(z.number().int().positive()),
});

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

    const actorId = Number(session.user.id);
    const { publicId } = await params;

    const parsed = payloadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "不正なリクエスト", details: parsed.error },
        { status: 400 },
      );
    }

    const { userId, roleIds } = parsed.data;
    const normalizedRoleIds = Array.from(new Set(roleIds));

    const project = await prisma.bewtsProject.findUnique({
      where: { publicId },
      select: { id: true, leaderId: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "プロジェクトが見つかりません" },
        { status: 404 },
      );
    }

    const actorHasRolePermission = Boolean(
      await prisma.bewtsPermissionCapability.findFirst({
        where: {
          projectId: project.id,
          userId: actorId,
          capability: { in: ["ASSIGN_ROLE", "GRANT_PERMISSION", "ADMIN"] },
        },
        select: { id: true },
      }),
    );
    const actorIsAdmin = Boolean(
      await prisma.bewtsPermission.findFirst({
        where: {
          projectId: project.id,
          userId: actorId,
          level: "ADMIN",
        },
        select: { id: true },
      }),
    );

    if (!actorHasRolePermission && !actorIsAdmin) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    if (userId === project.leaderId) {
      return NextResponse.json(
        { error: "リーダーを通常役割に割り当てることはできません" },
        { status: 400 },
      );
    }

    if (userId != null) {
      const isMember = Boolean(
        await prisma.bewtsRoomMember.findFirst({
          where: {
            userId,
            room: {
              projectId: project.id,
              isAllRoom: true,
            },
          },
          select: { id: true },
        }),
      );

      if (!isMember) {
        return NextResponse.json(
          { error: "対象ユーザーはプロジェクトメンバーではありません" },
          { status: 400 },
        );
      }
    }

    const editableRoles = await prisma.bewtsRole.findMany({
      where: {
        projectId: project.id,
        isLeader: false,
      },
      select: { id: true },
    });

    const editableRoleIdSet = new Set(editableRoles.map((role) => role.id));
    const containsInvalidRole = normalizedRoleIds.some(
      (roleId) => !editableRoleIdSet.has(roleId),
    );
    if (containsInvalidRole) {
      return NextResponse.json(
        { error: "不正な役割IDが含まれています" },
        { status: 400 },
      );
    }

    const roleRooms = await prisma.bewtsRoom.findMany({
      where: {
        projectId: project.id,
        isAllRoom: false,
        roleId: { in: Array.from(editableRoleIdSet) },
      },
      select: { id: true, roleId: true },
    });

    const roleRoomIds = roleRooms.map((room) => room.id);
    const selectedRoomIds = roleRooms
      .filter(
        (room): room is typeof room & { roleId: number } =>
          typeof room.roleId === "number" &&
          normalizedRoleIds.includes(room.roleId),
      )
      .map((room) => room.id);

    await prisma.$transaction(async (tx) => {
      if (roleRoomIds.length > 0) {
        await tx.bewtsRoomMember.deleteMany({
          where: {
            roomId: { in: roleRoomIds },
            userId,
          },
        });
      }

      if (selectedRoomIds.length > 0) {
        await tx.bewtsRoomMember.createMany({
          data: selectedRoomIds.map((roomId) => ({ roomId, userId })),
          skipDuplicates: true,
        });
      }
    });

    return NextResponse.json({ message: "役割を更新しました" });
  } catch (error) {
    console.error("Bewts role update error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "役割更新に失敗しました",
      },
      { status: 500 },
    );
  }
}
