import { auth } from "@/lib/auth";
import { createNotificationWithUserSetting } from "@/lib/notification-settings";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomId: string; messagePublicId: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number(session.user.id);
  const { roomId, messagePublicId } = await params;
  const id = Number(roomId);

  try {
    const body = await req.json();
    const { emoji } = body || {};
    if (!emoji || typeof emoji !== "string")
      return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });

    const room = await prisma.bewtsRoom.findUnique({
      where: { id },
      include: {
        members: { select: { userId: true } },
        project: { select: { leaderId: true, publicId: true } },
      },
    });
    if (!room)
      return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const isMember = room.members.some((m) => m.userId === userId);
    const isLeader = room.project?.leaderId === userId;
    const perm = await prisma.bewtsPermission.findFirst({
      where: { projectId: room.projectId, userId },
    });
    const isProjectAdmin = !!perm && perm.level === "ADMIN";

    if (!isMember && !isLeader && !isProjectAdmin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const message = await prisma.bewtsMessage.findUnique({
      where: { publicId: messagePublicId },
      include: { reactions: true },
    });
    if (!message)
      return NextResponse.json({ error: "Message not found" }, { status: 404 });

    const existing = message.reactions.find(
      (r) => r.userId === userId && r.emoji === emoji,
    );
    if (existing) {
      await prisma.bewtsMessageReaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.bewtsMessageReaction.create({
        data: { messageId: message.id, userId, emoji },
      });

      if (message.senderId !== userId) {
        const actor = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });

        if (actor) {
          await createNotificationWithUserSetting(prisma, {
            userId: message.senderId,
            actorId: userId,
            type: "CHAT",
            title: `【${room.name}】${actor.name}さんがリアクションしました`,
            message: emoji,
            redirectUrl: `/bewts/${room.project.publicId}/chat/${room.id}`,
            chatRoomId: room.id,
            bewtsProjectId: room.projectId,
          });
        }
      }
    }

    // return updated reaction summary
    const reactions = await prisma.bewtsMessageReaction.findMany({
      where: { messageId: message.id },
    });

    const grouped = Array.from(
      reactions.reduce((map, r) => {
        const cur = map.get(r.emoji) || {
          count: 0,
          firstReactedAt: r.createdAt,
          userReacted: false,
        };
        cur.count += 1;
        if (r.userId === userId) cur.userReacted = true;
        map.set(r.emoji, cur);
        return map;
      }, new Map()),
    ).map(([emoji, v]) => ({
      emoji,
      count: v.count,
      firstReactedAt: v.firstReactedAt.toISOString(),
    }));

    return NextResponse.json({ reactions: grouped });
  } catch (err) {
    console.error("Error toggling bewts reaction:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
