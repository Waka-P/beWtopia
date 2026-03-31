import { createChatRoomSchema } from "@/app/schemas/chat";
import { auth } from "@/lib/auth";
import { genPublicId } from "@/lib/id";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);

  // クエリパラメータから現在アクセス中のルーム publicId を取得
  const { searchParams } = new URL(req.url);
  const currentRoomPublicId = searchParams.get("currentRoomPublicId");

  try {
    // ChatRoomMember に isHidden フラグを追加したため、非表示のルームはここで除外する
    const rooms = await prisma.chatRoom.findMany({
      where: {
        members: {
          some: {
            userId: userId,
            isHidden: false,
          },
        },
      },
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
      orderBy: {
        createdAt: "desc",
      },
    });

    // 各ルームについて、(自分の) deletedAt を考慮して最新メッセージと未読件数を取得する
    const formattedRooms = await Promise.all(
      rooms.map(async (room) => {
        const myMember = room.members.find((m) => m.userId === userId);
        const opponentMember = room.members.find((m) => m.userId !== userId);
        const opponent = opponentMember ? opponentMember.user : null;

        const deletedAt = myMember?.deletedAt ?? null;

        const lastMessageRaw = await prisma.chatMessage.findFirst({
          where: {
            roomId: room.id,
            ...(deletedAt ? { createdAt: { gt: deletedAt } } : {}),
          },
          orderBy: { createdAt: "desc" },
          select: {
            userId: true,
            content: true,
            createdAt: true,
            attachments: { select: { type: true, name: true } },
            order: {
              select: {
                requesterUserId: true,
              },
            },
          },
        });

        const lastMessage = lastMessageRaw
          ? {
              content: lastMessageRaw.content,
              createdAt: lastMessageRaw.createdAt,
              attachments: lastMessageRaw.attachments,
              // 一番新しいメッセージがオーダーかどうかと、そのオーダーを出したのが自分かどうか
              isOrder: !!lastMessageRaw.order,
              isOwnOrder: lastMessageRaw.order?.requesterUserId === userId,
              // ビューズのスカウトカードメッセージかどうか（data-bewts-scout="1" で判定）
              isScout: (lastMessageRaw.content || "").includes(
                'data-bewts-scout="1"',
              ),
              isOwnScout: lastMessageRaw.userId === userId,
            }
          : null;

        const unreadCount = await prisma.chatMessage.count({
          where: {
            roomId: room.id,
            userId: { not: userId },
            reads: { none: { userId } },
            ...(deletedAt ? { createdAt: { gt: deletedAt } } : {}),
          },
        });

        return {
          id: room.id,
          publicId: room.publicId,
          members: room.members,
          lastMessage,
          opponent,
          unreadCount,
        };
      }),
    );

    // 削除済みルームのフィルタリング：
    // - deletedAt がない → 表示
    // - deletedAt があり、lastMessage が存在し、かつ deletedAt より後 → 表示（復活）
    // - deletedAt があり、lastMessage がない or deletedAt 以前、かつ currentRoomPublicId と一致 → 表示（アクセス中のみ）
    // - それ以外 → 非表示
    const visibleRooms = formattedRooms.filter((room) => {
      const myMember = room.members.find((m) => m.userId === userId);
      const deletedAt = myMember?.deletedAt;

      if (!deletedAt) return true; // 削除されていない

      const isCurrentRoom = room.publicId === currentRoomPublicId;
      const hasMessageAfterDelete =
        room.lastMessage &&
        new Date(room.lastMessage.createdAt).getTime() >
          new Date(deletedAt).getTime();

      // 削除時点以降にメッセージがあれば復活して表示
      if (hasMessageAfterDelete) return true;

      // メッセージがない、または削除時点以前のメッセージのみ → 現在アクセス中のルームのみ表示
      return isCurrentRoom;
    });

    // 最近メッセージ順にソート
    visibleRooms.sort((a, b) => {
      const timeA = a.lastMessage?.createdAt
        ? new Date(a.lastMessage.createdAt).getTime()
        : new Date(0).getTime();
      const timeB = b.lastMessage?.createdAt
        ? new Date(b.lastMessage.createdAt).getTime()
        : new Date(0).getTime();
      return timeB - timeA;
    });

    return NextResponse.json(visibleRooms);
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Zodでバリデーション
    const validationResult = createChatRoomSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((err) => ({
        path: err.path.join("."),
        message: err.message,
      }));

      return NextResponse.json(
        {
          error: "Validation failed",
          details: errors,
        },
        { status: 400 },
      );
    }

    const { targetUserId } = validationResult.data;

    // Find target user by publicId
    const targetUser = await prisma.user.findUnique({
      where: { publicId: targetUserId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const targetIdInt = targetUser.id;

    if (userId === targetIdInt) {
      return NextResponse.json(
        { error: "Cannot create chat with self" },
        { status: 400 },
      );
    }

    // ブロック状態を確認（どちらか一方でもブロックしている場合はルーム作成・再利用を拒否）
    const block = await prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: targetIdInt },
          { blockerId: targetIdInt, blockedId: userId },
        ],
      },
    });

    if (block) {
      return NextResponse.json(
        { error: "このユーザとのチャットは現在無効化されています" },
        { status: 403 },
      );
    }

    // Check if room already exists
    // Find a room where BOTH users are members.
    // Assuming 1-on-1 chats for now.
    const existingRoom = await prisma.chatRoom.findFirst({
      where: {
        AND: [
          {
            members: {
              some: {
                userId: userId,
              },
            },
          },
          {
            members: {
              some: {
                userId: targetIdInt,
              },
            },
          },
        ],
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    if (existingRoom) {
      return NextResponse.json(existingRoom);
    }

    // Create new room
    const newRoom = await prisma.chatRoom.create({
      data: {
        publicId: genPublicId(),
        members: {
          create: [{ userId: userId }, { userId: targetIdInt }],
        },
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    return NextResponse.json(newRoom);
  } catch (error) {
    console.error("Error creating room:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
