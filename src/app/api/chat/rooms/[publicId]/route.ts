import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const { publicId } = await params;

  try {
    const room = await prisma.chatRoom.findUnique({
      where: { publicId },
      include: {
        members: {
          select: {
            userId: true,
            deletedAt: true,
            isHidden: true,
            user: {
              select: {
                id: true,
                publicId: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const isMember = room.members.some((m) => m.userId === userId);
    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 相手を特定
    const opponentMember = room.members.find((m) => m.userId !== userId);
    const opponent = opponentMember ? opponentMember.user : null;

    return NextResponse.json({
      ...room,
      opponent,
    });
  } catch (error) {
    console.error("Error fetching room:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const { publicId } = await params;

  try {
    const room = await prisma.chatRoom.findUnique({
      where: { publicId },
      include: { members: true },
    });
    if (!room)
      return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const isMember = room.members.some((m) => m.userId === userId);
    if (!isMember)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const messageCount = await prisma.chatMessage.count({
      where: { roomId: room.id },
    });

    // 空ルームは論理削除ではなく物理削除する
    // （onDelete: Cascade で members / messages / notifications も連動削除）
    if (messageCount === 0) {
      await prisma.chatRoom.delete({
        where: { id: room.id },
      });

      return NextResponse.json({ ok: true, hardDeleted: true });
    }

    // メッセージがある場合は従来通り自分側のみ論理削除
    await prisma.chatRoomMember.update({
      where: { roomId_userId: { roomId: room.id, userId } },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error deleting room:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
