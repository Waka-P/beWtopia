import { auth } from "@/lib/auth";
import {
  defaultCapabilitiesByLevel,
  levelFromCapabilities,
  normalizeCapabilities,
} from "@/lib/bewtsCapabilities";
import { prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const payloadSchema = z.object({
  userId: z.number().int().positive(),
  level: z.enum(["MEMBER", "PUBLISHER", "ADMIN"]).optional(),
  capabilities: z.array(z.string()).optional(),
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

    const body = await req.json();
    const parsed = payloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "不正なリクエスト", details: parsed.error },
        { status: 400 },
      );
    }

    const { userId, level, capabilities } = parsed.data;

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

    const actorHasGrantPermission = Boolean(
      await prisma.bewtsPermissionCapability.findFirst({
        where: {
          projectId: project.id,
          userId: actorId,
          capability: "GRANT_PERMISSION",
        },
        select: { id: true },
      }),
    );
    const actorIsLevelAdmin = Boolean(
      await prisma.bewtsPermission.findFirst({
        where: {
          projectId: project.id,
          userId: actorId,
          level: "ADMIN",
        },
        select: { id: true },
      }),
    );

    if (!actorHasGrantPermission && !actorIsLevelAdmin) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    if (userId === project.leaderId) {
      return NextResponse.json(
        { error: "リーダーの権限は変更できません" },
        { status: 400 },
      );
    }

    const targetIsMember = Boolean(
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

    if (!targetIsMember) {
      return NextResponse.json(
        { error: "対象ユーザーはプロジェクトのメンバーではありません" },
        { status: 400 },
      );
    }

    const normalizedCapabilities = normalizeCapabilities(
      Array.isArray(capabilities)
        ? capabilities
        : defaultCapabilitiesByLevel(level ?? "MEMBER"),
    );
    const derivedLevel = levelFromCapabilities(normalizedCapabilities);

    const updated = await prisma.$transaction(async (tx) => {
      const permission = await tx.bewtsPermission.upsert({
        where: {
          projectId_userId: {
            projectId: project.id,
            userId,
          },
        },
        create: {
          projectId: project.id,
          userId,
          level: derivedLevel,
        },
        update: { level: derivedLevel },
        select: {
          userId: true,
          level: true,
        },
      });

      await tx.bewtsPermissionCapability.deleteMany({
        where: {
          projectId: project.id,
          userId,
        },
      });

      await tx.bewtsPermissionCapability.createMany({
        data: normalizedCapabilities.map((capability) => ({
          projectId: project.id,
          userId,
          capability,
        })),
        skipDuplicates: true,
      });

      return permission;
    });

    return NextResponse.json({
      message: "権限を更新しました",
      permission: {
        ...updated,
        capabilities: normalizedCapabilities,
      },
    });
  } catch (error) {
    console.error("Bewts permission update error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "権限更新に失敗しました",
      },
      { status: 500 },
    );
  }
}
