import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeUserInput } from "@/utils/normalize";
import { NextResponse } from "next/server";

async function checkTaskAccess(roomId: number, taskId: number, userId: number) {
  const room = await prisma.bewtsRoom.findUnique({
    where: { id: roomId },
    include: {
      members: { select: { userId: true } },
      project: { select: { leaderId: true } },
    },
  });
  if (!room) return null;
  const isMember = room.members.some((m) => m.userId === userId);
  const isLeader = room.project?.leaderId === userId;
  const perm = await prisma.bewtsPermission.findFirst({
    where: { projectId: room.projectId, userId },
  });
  if (!isMember && !isLeader && !perm) return null;

  const chart = await prisma.bewtsGanttChart.findUnique({
    where: { roomId },
  });
  if (!chart) return null;

  const task = await prisma.bewtsGanttTask.findFirst({
    where: { id: taskId, chartId: chart.id },
  });
  return task ? { room, chart, task } : null;
}

// PUT: update task
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ roomId: string; taskId: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number(session.user.id);
  const { roomId, taskId } = await params;

  const access = await checkTaskAccess(Number(roomId), Number(taskId), userId);
  if (!access)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

  // update task fields
  await prisma.bewtsGanttTask.update({
    where: { id: Number(taskId) },
    data: {
      ...(name !== undefined && { name: normalizeUserInput(name) }),
      ...(description !== undefined && {
        description: normalizeUserInput(description),
      }),
      ...(progress !== undefined && { progress }),
      ...(status !== undefined && { status: normalizeUserInput(status) }),
      ...(memo !== undefined && { memo: normalizeUserInput(memo) }),
      ...(color !== undefined && { color }),
      ...(normalizedAssigneeIds !== null && {
        assigneeId:
          normalizedAssigneeIds.length > 0 ? normalizedAssigneeIds[0] : null,
      }),
    },
  });

  // replace assignees if provided
  if (normalizedAssigneeIds !== null) {
    await prisma.bewtsGanttTaskAssignment.deleteMany({
      where: { taskId: Number(taskId) },
    });
    if (normalizedAssigneeIds.length > 0) {
      await prisma.bewtsGanttTaskAssignment.createMany({
        data: normalizedAssigneeIds.map((uid) => ({
          taskId: Number(taskId),
          userId: uid,
        })),
      });
    }
  }

  // replace segments if provided
  if (segments !== undefined) {
    await prisma.bewtsGanttTaskSegment.deleteMany({
      where: { taskId: Number(taskId) },
    });
    if (segments.length > 0) {
      await prisma.bewtsGanttTaskSegment.createMany({
        data: (
          segments as Array<{
            startAt: string;
            endAt: string;
            label?: string;
            note?: string;
            color?: string;
            order?: number;
          }>
        ).map((s, i) => ({
          taskId: Number(taskId),
          startAt: new Date(s.startAt),
          endAt: new Date(s.endAt),
          label: normalizeUserInput(s.label ?? ""),
          note: normalizeUserInput(s.note ?? "") || null,
          color: s.color ?? null,
          order: s.order ?? i,
        })),
      });
    }
  }

  const updated = await prisma.bewtsGanttTask.findUnique({
    where: { id: Number(taskId) },
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

  return NextResponse.json(updated);
}

// DELETE: delete task
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ roomId: string; taskId: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number(session.user.id);
  const { roomId, taskId } = await params;

  const access = await checkTaskAccess(Number(roomId), Number(taskId), userId);
  if (!access)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.bewtsGanttTask.delete({ where: { id: Number(taskId) } });

  return NextResponse.json({ ok: true });
}
