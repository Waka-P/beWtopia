import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number(session.user.id);
  const { roomId } = await params;
  const id = Number(roomId);

  try {
    const room = await prisma.bewtsRoom.findUnique({
      where: { id },
      include: {
        members: {
          select: {
            userId: true,
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                publicId: true,
              },
            },
          },
        },
        role: { select: { id: true, name: true } },
        project: {
          select: {
            leaderId: true,
          },
        },
      },
    });

    if (!room)
      return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const isMember = room.members.some((m) => m.userId === userId);

    // allow project leader or project ADMIN (permissions table)
    const leaderId = room.project?.leaderId;
    const isLeader = leaderId === userId;
    const perm = await prisma.bewtsPermission.findFirst({
      where: { projectId: room.projectId, userId },
    });
    const isProjectAdmin = !!perm && perm.level === "ADMIN";

    if (!isMember && !isLeader && !isProjectAdmin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // --- フロントのメンバー表示用に、役割別ルームでもリーダーを members に含める ---
    let membersWithLeader = room.members;
    if (leaderId != null) {
      const alreadyIncluded = room.members.some((m) => m.userId === leaderId);
      if (!alreadyIncluded) {
        const leaderUser = await prisma.user.findUnique({
          where: { id: leaderId },
          select: {
            id: true,
            name: true,
            image: true,
            publicId: true,
          },
        });

        if (leaderUser) {
          membersWithLeader = [
            ...room.members,
            {
              userId: leaderUser.id,
              user: leaderUser,
            },
          ];
        }
      }
    }

    return NextResponse.json({
      ...room,
      members: membersWithLeader,
      viewerUserId: userId,
    });
  } catch (err) {
    console.error("Error fetching bewts room:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number(session.user.id);
  const { roomId } = await params;
  const id = Number(roomId);

  try {
    const room = await prisma.bewtsRoom.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!room)
      return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const isMember = room.members.some((m) => m.userId === userId);
    if (!isMember)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Clear user's membership from this room (remove BewtsRoomMember)
    await prisma.bewtsRoomMember.deleteMany({
      where: { roomId: room.id, userId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error deleting bewts room membership:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
