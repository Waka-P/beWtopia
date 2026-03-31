import {
  createChatMessageSchema,
  hasSendableContent,
} from "@/app/schemas/chat";
import { auth } from "@/lib/auth";
import { genPublicId } from "@/lib/id";
import { createNotificationsWithUserSetting } from "@/lib/notification-settings";
import { prisma } from "@/lib/prisma";
import { sanitizeAndNormalizeTiptapHtml } from "@/utils/normalize";
import { NextResponse } from "next/server";

function extractMentionPublicIdsFromHtml(content: string): string[] {
  if (!content) return [];

  const ids = new Set<string>();
  const patterns = [
    /data-type="mention"[^>]*data-id="([^"]+)"/g,
    /data-id="([^"]+)"[^>]*data-type="mention"/g,
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const id = match[1]?.trim();
      if (id) ids.add(id);
    }
  }

  return Array.from(ids);
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

  try {
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

    const messages = await prisma.bewtsMessage.findMany({
      where: { roomId: room.id },
      include: {
        sender: {
          select: { id: true, publicId: true, name: true, image: true },
        },
        attachments: { orderBy: { displayOrder: "asc" } },
        reactions: true,
        reads: { select: { userId: true, readAt: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // mark unread as read for this user
    const unreadIds = messages
      .filter((m) => m.senderId !== userId)
      .filter((m) => !m.reads.some((r) => r.userId === userId))
      .map((m) => m.id);

    if (unreadIds.length > 0) {
      await prisma.bewtsMessageRead.createMany({
        data: unreadIds.map((messageId) => ({ messageId, userId })),
        skipDuplicates: true,
      });
    }

    const formatted = messages.map((msg) => {
      const reactionMap = new Map();
      msg.reactions.forEach((r) => {
        const cur = reactionMap.get(r.emoji) || {
          count: 0,
          userReacted: false,
        };
        cur.count++;
        if (r.userId === userId) cur.userReacted = true;
        reactionMap.set(r.emoji, cur);
      });

      const reactions = Array.from(reactionMap.entries()).map(
        ([emoji, val]) => ({
          emoji,
          count: val.count,
          userReacted: val.userReacted,
        }),
      );

      return {
        id: msg.id,
        publicId: msg.publicId,
        content: msg.content,
        createdAt: msg.createdAt,
        user: msg.sender,
        reactions,
        attachments: msg.attachments.map((a) => ({
          id: a.id,
          url: a.fileUrl,
          type: a.fileType,
          name: a.fileName,
        })),
        isOwn: msg.senderId === userId,
        isRead: msg.reads.some(
          (r) => r.userId !== userId && r.userId !== msg.senderId,
        ),
        readBy: msg.reads.filter((r) => r.userId !== msg.senderId).length,
      };
    });

    return NextResponse.json(formatted);
  } catch (err) {
    console.error("Error fetching bewts messages:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

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

  try {
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
    const normalizedContent = content
      ? sanitizeAndNormalizeTiptapHtml(content)
      : "";
    const hasAttachments = (attachments ?? []).length > 0;

    if (!hasSendableContent(normalizedContent) && !hasAttachments) {
      return NextResponse.json(
        { error: "メッセージまたは添付ファイルが必要です" },
        { status: 400 },
      );
    }

    const room = await prisma.bewtsRoom.findUnique({
      where: { id },
      include: {
        members: { select: { userId: true } },
        project: { select: { leaderId: true, publicId: true, name: true } },
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

    const created = await prisma.bewtsMessage.create({
      data: {
        publicId: genPublicId(),
        // schema requires non-null string for content, use empty string for attachment-only messages
        content: normalizedContent,
        roomId: room.id,
        senderId: userId,
        attachments: {
          create: (attachments || []).map(
            (a: { url: string; type: string; name?: string }, i: number) => ({
              fileUrl: a.url,
              fileType: a.type,
              fileName: a.name ?? "",
              displayOrder: i,
            }),
          ),
        },
      },
    });

    const newMsg = await prisma.bewtsMessage.findUnique({
      where: { id: created.id },
      include: {
        sender: {
          select: { id: true, publicId: true, name: true, image: true },
        },
        attachments: true,
        reactions: true,
      },
    });

    if (!newMsg) {
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 },
      );
    }

    const mentionPublicIds = extractMentionPublicIdsFromHtml(normalizedContent);
    const roomMemberIds = room.members
      .map((member) => member.userId)
      .filter((memberId) => memberId !== userId);
    const plainText = (newMsg.content || "").replace(/<[^>]+>/g, "").trim();
    const previewText = plainText
      ? plainText.slice(0, 80)
      : "新着メッセージがあります";

    let mentionedUserIds = new Set<number>();

    if (mentionPublicIds.length > 0) {
      const mentionedUsers = await prisma.user.findMany({
        where: {
          publicId: { in: mentionPublicIds },
          id: { in: roomMemberIds },
        },
        select: {
          id: true,
        },
      });

      if (mentionedUsers.length > 0) {
        mentionedUserIds = new Set(mentionedUsers.map((user) => user.id));
        const redirectUrl = `/bewts/${room.project.publicId}/chat/${room.id}`;

        await createNotificationsWithUserSetting(
          prisma,
          mentionedUsers.map((target) => ({
            userId: target.id,
            actorId: userId,
            type: "CHAT",
            title: `【${room.name}】${newMsg.sender.name}さんがあなたをメンションしました`,
            message: null,
            redirectUrl,
            chatRoomId: room.id,
            bewtsProjectId: room.projectId,
          })),
        );
      }
    }

    const generalTargetIds = roomMemberIds.filter(
      (memberId) => !mentionedUserIds.has(memberId),
    );

    if (generalTargetIds.length > 0) {
      const redirectUrl = `/bewts/${room.project.publicId}/chat/${room.id}`;

      await createNotificationsWithUserSetting(
        prisma,
        generalTargetIds.map((targetUserId) => ({
          userId: targetUserId,
          actorId: userId,
          type: "CHAT",
          title: `【${room.name}】${newMsg.sender.name}さんからのチャット`,
          message: previewText,
          redirectUrl,
          chatRoomId: room.id,
          bewtsProjectId: room.projectId,
        })),
      );
    }

    const resp = {
      id: newMsg.id,
      publicId: newMsg.publicId,
      content: newMsg.content,
      createdAt: newMsg.createdAt,
      user: newMsg.sender,
      reactions: [],
      isRead: false,
      readBy: 0,
      attachments: newMsg.attachments.map(
        (a: {
          id: number;
          fileUrl: string;
          fileType: string;
          fileName: string;
        }) => ({
          id: a.id,
          url: a.fileUrl,
          type: a.fileType,
          name: a.fileName,
        }),
      ),
      isOwn: true,
    };

    return NextResponse.json(resp);
  } catch (err) {
    console.error("Error sending bewts message:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
