import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// PUT: reorder tasks
// body: { orderedIds: number[] }  — full ordered list of task IDs
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number(session.user.id);
  const { roomId } = await params;
  const id = Number(roomId);

  const room = await prisma.bewtsRoom.findUnique({
    where: { id },
    include: {
      members: { select: { userId: true } },
      project: { select: { leaderId: true } },
    },
  });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isMember = room.members.some((m) => m.userId === userId);
  const isLeader = room.project?.leaderId === userId;
  const perm = await prisma.bewtsPermission.findFirst({
    where: { projectId: room.projectId, userId },
  });
  if (!isMember && !isLeader && !perm)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { orderedIds } = (await req.json()) as { orderedIds: number[] };

  await prisma.$transaction(
    orderedIds.map((taskId, index) =>
      prisma.bewtsGanttTask.update({
        where: { id: taskId },
        data: { displayOrder: index + 1 },
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}
