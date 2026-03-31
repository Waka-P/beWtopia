import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function checkRoomAccess(roomId: number, userId: number) {
  const room = await prisma.bewtsRoom.findUnique({
    where: { id: roomId },
    include: {
      members: { select: { userId: true } },
      project: { select: { leaderId: true, id: true } },
    },
  });
  if (!room) return null;

  const isMember = room.members.some((m) => m.userId === userId);
  const isLeader = room.project?.leaderId === userId;
  const perm = await prisma.bewtsPermission.findFirst({
    where: { projectId: room.projectId, userId },
  });
  const isProjectMember = !!perm;

  if (!isMember && !isLeader && !isProjectMember) return null;
  return room;
}

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

  const room = await checkRoomAccess(id, userId);
  if (!room) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // get or create gantt chart for this room
  let chart = await prisma.bewtsGanttChart.findUnique({
    where: { roomId: id },
    include: {
      tasks: {
        include: {
          assignee: { select: { id: true, name: true, image: true } },
          assignments: {
            include: {
              user: { select: { id: true, name: true, image: true } },
            },
          },
          segments: { orderBy: { order: "asc" } },
        },
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  if (!chart) {
    chart = await prisma.bewtsGanttChart.create({
      data: { roomId: id },
      include: {
        tasks: {
          include: {
            assignee: { select: { id: true, name: true, image: true } },
            assignments: {
              include: {
                user: { select: { id: true, name: true, image: true } },
              },
            },
            segments: { orderBy: { order: "asc" } },
          },
          orderBy: { displayOrder: "asc" },
        },
      },
    });
  }

  return NextResponse.json(chart);
}
