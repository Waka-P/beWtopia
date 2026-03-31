import { createChatMessageSchema } from "@/app/schemas/chat";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE(
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
    const room = await prisma.bewtsRoom.findUnique({
      where: { id },
      include: { project: { select: { leaderId: true } } },
    });
    if (!room)
      return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const message = await prisma.bewtsMessage.findUnique({
      where: { publicId: messagePublicId },
    });
    if (!message)
      return NextResponse.json({ error: "Message not found" }, { status: 404 });

    if (message.senderId !== userId) {
      // only author, project leader, or project admin can delete
      const perm = await prisma.bewtsPermission.findFirst({
        where: { projectId: room.projectId, userId },
      });
      const isProjectAdmin = !!perm && perm.level === "ADMIN";
      const isLeader = room.project?.leaderId === userId;
      if (!isProjectAdmin && !isLeader) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    await prisma.bewtsMessage.delete({ where: { id: message.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error deleting bewts message:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ roomId: string; messagePublicId: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number(session.user.id);
  const { roomId, messagePublicId } = await params;
  const id = Number(roomId);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = createChatMessageSchema.safeParse(body);
  if (!validation.success) {
    const first = validation.error.issues[0];
    return NextResponse.json({ error: first.message }, { status: 400 });
  }

  const { content, attachments } = validation.data;

  try {
    const room = await prisma.bewtsRoom.findUnique({
      where: { id },
      include: {
        project: { select: { leaderId: true } },
      },
    });
    if (!room)
      return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const message = await prisma.bewtsMessage.findUnique({
      where: { publicId: messagePublicId },
    });
    if (!message)
      return NextResponse.json({ error: "Message not found" }, { status: 404 });

    if (message.senderId !== userId) {
      const perm = await prisma.bewtsPermission.findFirst({
        where: { projectId: room.projectId, userId },
      });
      const isProjectAdmin = !!perm && perm.level === "ADMIN";
      const isLeader = room.project?.leaderId === userId;
      if (!isProjectAdmin && !isLeader) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.bewtsMessageAttachment.deleteMany({
        where: { messageId: message.id },
      });

      await tx.bewtsMessage.update({
        where: { id: message.id },
        data: {
          content: content ?? "",
          attachments:
            attachments && attachments.length > 0
              ? {
                  create: attachments.map((a, i) => ({
                    fileUrl: a.url,
                    fileType: a.type,
                    fileName: a.name ?? "",
                    displayOrder: i,
                  })),
                }
              : undefined,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error updating bewts message:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
