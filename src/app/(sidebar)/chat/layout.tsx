import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import styles from "./chat.module.scss";
import ChatList from "./components/ChatList";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // サーバーサイドで現在ユーザーのルーム一覧を取得して子コンポーネントへ渡す
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.id) {
    redirect("/login");
  }

  type InitialRoom = {
    id: number;
    publicId: string;
    members: {
      user: {
        id: number;
        publicId: string;
        name: string;
        image: string | null;
      };
      userId?: number;
      roomId?: number;
    }[];
    // lastMessage は存在しない場合 undefined にする（クライアント側 ChatRoom 型に合わせる）
    lastMessage?: {
      content: string | null;
      createdAt: string; // ISO string
      attachments?: { type: string; name?: string | null }[];
    };
    opponent?:
      | {
          id: number;
          publicId: string;
          name: string;
          image: string | null;
        }
      | undefined;
    unreadCount?: number;
  };

  let initialRooms: InitialRoom[] = [];

  if (session?.user?.id) {
    const userId = Number(session.user.id);

    const rooms = await prisma.chatRoom.findMany({
      where: {
        members: { some: { userId } },
      },
      include: {
        members: {
          select: {
            userId: true,
            deletedAt: true,
            isHidden: true,
            user: {
              select: { id: true, publicId: true, name: true, image: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            content: true,
            createdAt: true,
            attachments: { select: { type: true, name: true } },
            order: {
              select: {
                requesterUserId: true,
              },
            },
          },
        },
      },
    });

    const formatted = rooms.map((room) => {
      const opponentMember = room.members.find((m) => m.userId !== userId);
      const opponent = opponentMember ? opponentMember.user : undefined;

      const lastMsg = room.messages[0];
      return {
        id: room.id,
        publicId: room.publicId,
        members: room.members,
        lastMessage: lastMsg
          ? {
              content: lastMsg.content,
              createdAt: lastMsg.createdAt.toISOString(),
              attachments: lastMsg.attachments,
              isOrder: !!lastMsg.order,
              isOwnOrder: lastMsg.order?.requesterUserId === userId,
            }
          : undefined,
        opponent,
        unreadCount: 0,
      };
    });

    // 未読集計（簡易）
    const roomIds = rooms.map((r) => r.id);
    if (roomIds.length > 0) {
      const unreadGroups = await prisma.chatMessage.groupBy({
        by: ["roomId"],
        where: {
          roomId: { in: roomIds },
          userId: { not: userId },
          reads: { none: { userId } },
        },
        _count: { _all: true },
      });
      const unreadMap = new Map<number, number>();
      unreadGroups.forEach((g) => {
        unreadMap.set(g.roomId, g._count._all);
      });

      formatted.forEach((r) => {
        r.unreadCount = unreadMap.get(r.id) || 0;
      });
    }

    // Sort by lastMessage if available
    formatted.sort((a, b) => {
      const timeA = a.lastMessage?.createdAt
        ? new Date(a.lastMessage.createdAt).getTime()
        : 0;
      const timeB = b.lastMessage?.createdAt
        ? new Date(b.lastMessage.createdAt).getTime()
        : 0;
      return timeB - timeA;
    });

    initialRooms = formatted;
  }

  return (
    <div className={styles.container}>
      {/* server-provided initialRooms を ChatList に渡す */}
      <ChatList initialRooms={initialRooms} />
      <div className={styles.main}>{children}</div>
    </div>
  );
}
