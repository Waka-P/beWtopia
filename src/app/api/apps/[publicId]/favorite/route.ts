import { auth } from "@/lib/auth";
import { createNotificationsWithUserSetting } from "@/lib/notification-settings";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;

  if (!publicId || typeof publicId !== "string") {
    return NextResponse.json({ error: "Invalid app id" }, { status: 400 });
  }

  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const app = await prisma.app.findUnique({ where: { publicId } });

  if (!app) {
    return NextResponse.json({ error: "App not found" }, { status: 404 });
  }

  const existingFavorite = await prisma.appFavorite.findUnique({
    where: {
      appId_userId: {
        appId: app.id,
        userId,
      },
    },
    select: { appId: true },
  });

  if (!existingFavorite) {
    await prisma.appFavorite.create({
      data: {
        appId: app.id,
        userId,
      },
    });

    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, publicId: true },
    });

    if (actor) {
      const [followerRows, projectRows, project] = await Promise.all([
        prisma.userFollow.findMany({
          where: { followingId: userId },
          select: { followerId: true },
        }),
        app.bewtsProjectId
          ? prisma.bewtsRoomMember.findMany({
              where: {
                room: {
                  projectId: app.bewtsProjectId,
                  isAllRoom: true,
                },
              },
              select: { userId: true },
            })
          : Promise.resolve([]),
        app.bewtsProjectId
          ? prisma.bewtsProject.findUnique({
              where: { id: app.bewtsProjectId },
              select: { id: true, publicId: true, name: true, leaderId: true },
            })
          : Promise.resolve(null),
      ]);

      const projectParticipantIds = new Set<number>();
      if (project) {
        projectParticipantIds.add(project.leaderId);
      }
      for (const row of projectRows) {
        projectParticipantIds.add(row.userId);
      }

      const followerRecipientIds = Array.from(
        new Set(
          followerRows
            .map((row) => row.followerId)
            .filter(
              (targetUserId) =>
                targetUserId !== userId &&
                !projectParticipantIds.has(targetUserId),
            ),
        ),
      );

      if (followerRecipientIds.length > 0) {
        await createNotificationsWithUserSetting(
          prisma,
          followerRecipientIds.map((targetUserId) => ({
            userId: targetUserId,
            actorId: userId,
            type: "BEWT",
            title: `${actor.name}さんがビュートしました`,
            message: app.name,
            redirectUrl: `/apps/${publicId}`,
            appId: app.id,
          })),
        );
      }

      if (project) {
        const bewtsRecipientIds = Array.from(projectParticipantIds).filter(
          (targetUserId) => targetUserId !== userId,
        );

        if (bewtsRecipientIds.length > 0) {
          await createNotificationsWithUserSetting(
            prisma,
            bewtsRecipientIds.map((targetUserId) => ({
              userId: targetUserId,
              actorId: userId,
              type: "BEWT",
              title: `参加中のビューズ「${project.name}」がビュートされました`,
              message: `${actor.name}さんが「${app.name}」をビュートしました`,
              redirectUrl: `/bewts/${project.publicId}`,
              appId: app.id,
              bewtsProjectId: project.id,
            })),
          );
        }
      }
    }
  }

  const favoritesCount = await prisma.appFavorite.count({
    where: { appId: app.id },
  });

  return NextResponse.json({ isFavorite: true, favoritesCount });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;

  if (!publicId || typeof publicId !== "string") {
    return NextResponse.json({ error: "Invalid app id" }, { status: 400 });
  }

  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const app = await prisma.app.findUnique({ where: { publicId } });

  if (!app) {
    return NextResponse.json({ error: "App not found" }, { status: 404 });
  }

  try {
    await prisma.appFavorite.delete({
      where: {
        appId_userId: {
          appId: app.id,
          userId,
        },
      },
    });
  } catch {
    // 既に削除済みなどは無視
  }

  const favoritesCount = await prisma.appFavorite.count({
    where: { appId: app.id },
  });

  return NextResponse.json({ isFavorite: false, favoritesCount });
}
