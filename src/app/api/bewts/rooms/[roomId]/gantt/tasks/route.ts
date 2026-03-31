import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeUserInput } from "@/utils/normalize";
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
  if (!isMember && !isLeader && !perm) return null;
  return room;
}

// POST: create a new task
export async function POST(
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

  const body = await req.json();
  const {
    name,
    description,
    progress,
    status,
    memo,
    color,
    assigneeId,
    assigneeUserIds,
    segments,
  } = body;

  const normalizedAssigneeIds: number[] | null = Array.isArray(assigneeUserIds)
    ? (assigneeUserIds as unknown[])
        .map((v) => Number(v))
        .filter((v) => Number.isInteger(v))
    : assigneeId !== undefined
      ? assigneeId === null
        ? []
        : [Number(assigneeId)]
      : null;

  // get or create chart
  let chart = await prisma.bewtsGanttChart.findUnique({
    where: { roomId: id },
    include: { tasks: { select: { displayOrder: true } } },
  });
  if (!chart) {
    chart = await prisma.bewtsGanttChart.create({
      data: { roomId: id },
      include: { tasks: { select: { displayOrder: true } } },
    });
  }

  const maxOrder =
    chart.tasks.length > 0
      ? Math.max(...chart.tasks.map((t) => t.displayOrder))
      : 0;

  const task = await prisma.bewtsGanttTask.create({
    data: {
      chartId: chart.id,
      name: normalizeUserInput(name) || "新しいタスク",
      description: normalizeUserInput(description) ?? null,
      progress: progress ?? 0,
      status: normalizeUserInput(status) ?? "未着手",
      memo: normalizeUserInput(memo) ?? null,
      color: color ?? null,
      displayOrder: maxOrder + 1,
      assigneeId:
        normalizedAssigneeIds && normalizedAssigneeIds.length > 0
          ? normalizedAssigneeIds[0]
          : null,
      assignments:
        normalizedAssigneeIds && normalizedAssigneeIds.length > 0
          ? {
              createMany: {
                data: normalizedAssigneeIds.map((uid) => ({ userId: uid })),
              },
            }
          : undefined,
      segments: segments
        ? {
            create: (
              segments as Array<{
                startAt: string;
                endAt: string;
                label?: string;
                note?: string;
                color?: string;
                order?: number;
              }>
            ).map((s, i) => ({
              startAt: new Date(s.startAt),
              endAt: new Date(s.endAt),
              label: normalizeUserInput(s.label ?? "") || null,
              note: normalizeUserInput(s.note ?? "") || null,
              color: s.color ?? null,
              order: s.order ?? i,
            })),
          }
        : undefined,
    },
    include: {
      assignee: { select: { id: true, name: true, image: true } },
      assignments: {
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
      },
      segments: { orderBy: { order: "asc" } },
    },
  });

  return NextResponse.json(task, { status: 201 });
}
