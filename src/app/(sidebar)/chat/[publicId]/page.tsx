import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getUserPrivacyActions } from "../../lib/privacyActions";
import { getUserEmojiStats } from "../../requests/lib/getUserEmojiStats";
import ChatArea from "../components/ChatArea";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  if (!publicId || typeof publicId !== "string") notFound();
  // 相手の名前をタイトルに入れる（可能なら現在のセッションから自分のIDを取得して相手を決定）
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const room = await prisma.chatRoom.findUnique({
    where: { publicId },
    include: {
      members: {
        select: {
          userId: true,
          deletedAt: true,
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

  if (!room) notFound();

  let displayName = "チャット";

  // セッションがある場合は自分以外のメンバー名を優先して使う
  if (session?.user?.id) {
    const myId = Number(session.user.id);
    const opponentMember = room.members.find((m) => m.userId !== myId) ?? null;
    const opponent = opponentMember?.user ?? null;
    if (opponent?.name) displayName = opponent.name;
    // 退避としてルーム名があれば使う（スキーマに存在する場合）
    else {
      const roomName = (room as { name?: string | null }).name;
      if (roomName) displayName = roomName;
    }
  } else {
    // セッションが取れなかった場合は最初のメンバー名を使う
    const first = room.members[0];
    if (first?.user?.name) displayName = first.user.name;
  }

  return {
    title: `チャット - ${displayName}`,
  };
}

export default async function ChatRoomPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const currUser = await prisma.user.findUnique({
    where: { id: Number(session.user.id) },
    select: {
      id: true,
      publicId: true,
    },
  });

  if (!currUser) {
    redirect("/login");
  }

  const myId = Number(session.user.id);

  const room = await prisma.chatRoom.findUnique({
    where: { publicId },
    include: {
      members: {
        include: {
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
    notFound();
  }

  const isMember = room.members.some((m) => m.userId === myId);
  if (!isMember) {
    notFound();
  }

  const opponentMember = room.members.find((m) => m.userId !== myId) ?? null;
  const opponent = opponentMember?.user ?? null;

  // ブロック状態を判定（サーバ側で取得）
  let isBlocked = false; // 自分が相手をブロックしているか
  let isBlockedBy = false; // 相手が自分をブロックしているか

  if (opponent) {
    const block = await prisma.userBlock.findUnique({
      where: {
        blockedId_blockerId: {
          blockedId: opponent.id,
          blockerId: myId,
        },
      },
    });
    isBlocked = !!block;

    const blockedBy = await prisma.userBlock.findUnique({
      where: {
        blockedId_blockerId: {
          blockedId: myId,
          blockerId: opponent.id,
        },
      },
    });
    isBlockedBy = !!blockedBy;
  }

  // サーバー側で初期メッセージも取得しておき、クライアント側のチラつきを減らす
  const myMember = room.members.find((m) => m.userId === myId) ?? null;
  const deletedAt = myMember?.deletedAt ?? null;

  const rawMessages = await prisma.chatMessage.findMany({
    where: {
      roomId: room.id,
      ...(deletedAt ? { createdAt: { gt: deletedAt } } : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          publicId: true,
          name: true,
          image: true,
        },
      },
      attachments: {
        orderBy: { displayOrder: "asc" },
      },
      reactions: true,
      order: true,
      reads: {
        select: {
          userId: true,
          readAt: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  // 自分が送っていないメッセージを既読にする（API と同じロジック）
  const unreadMessageIds = rawMessages
    .filter((msg) => msg.userId !== myId)
    .filter((msg) => !msg.reads.some((r) => r.userId === myId))
    .map((msg) => msg.id);

  if (unreadMessageIds.length > 0) {
    await prisma.chatMessageRead.createMany({
      data: unreadMessageIds.map((messageId) => ({
        messageId,
        userId: myId,
      })),
      skipDuplicates: true,
    });
  }

  const initialMessages = rawMessages.map((msg) => {
    const reactionMap = new Map<
      string,
      { count: number; userReacted: boolean }
    >();

    msg.reactions.forEach((r) => {
      const current = reactionMap.get(r.emoji) || {
        count: 0,
        userReacted: false,
      };
      current.count++;
      if (r.userId === myId) {
        current.userReacted = true;
      }
      reactionMap.set(r.emoji, current);
    });

    const reactions = Array.from(reactionMap.entries()).map(([emoji, val]) => ({
      emoji,
      // 既存 API では firstReactedAt は使っていないため createdAt を入れておく
      firstReactedAt: msg.createdAt.toISOString(),
      count: val.count,
      userReacted: val.userReacted,
    }));

    return {
      id: msg.id,
      publicId: msg.publicId,
      content: msg.content,
      createdAt: msg.createdAt.toISOString(),
      user: msg.user,
      reactions,
      attachments: msg.attachments,
      isOwn: msg.userId === myId,
      isRead: msg.reads.some(
        (r) => r.userId !== myId && r.userId !== msg.userId,
      ),
      readBy: msg.reads.filter((r) => r.userId !== msg.userId).length,
      order: msg.order
        ? {
            id: msg.order.id,
            publicId: msg.order.publicId,
            title: msg.order.title,
            description: msg.order.description,
            price: msg.order.price != null ? Number(msg.order.price) : null,
            priceUnit: msg.order.priceUnit,
            deadline: msg.order.deadline?.toISOString() ?? null,
            status: msg.order.status,
            requesterUserId: msg.order.requesterUserId,
            targetUserId: msg.order.targetUserId,
          }
        : null,
    };
  });

  const userEmojiStats = await getUserEmojiStats();

  let opponentUserId: number | null = null;
  let opponentPrivacyActions: Awaited<
    ReturnType<typeof getUserPrivacyActions>
  > | null = null;
  let initialScoutProjects:
    | {
        publicId: string;
        name: string;
        memberCount: number;
        maxMembers: number;
        availableRoles: { id: number; name: string }[];
      }[]
    | null = null;

  if (opponent) {
    opponentUserId = opponent.id;
    opponentPrivacyActions = await getUserPrivacyActions(opponent.id);

    // チャット相手に対してスカウト可能なビューズプロジェクト一覧をサーバーサイドで取得
    const targetUserId = opponent.id;

    if (targetUserId !== myId) {
      const projects = await prisma.bewtsProject.findMany({
        where: {
          leaderId: myId,
          status: "RECRUITING",
        },
        select: {
          id: true,
          publicId: true,
          name: true,
          leaderId: true,
          maxMembers: true,
          status: true,
          rooms: {
            select: {
              roleId: true,
              isAllRoom: true,
              members: {
                select: { userId: true },
              },
            },
          },
          joinRequests: {
            where: { userId: targetUserId },
            select: { id: true, status: true },
          },
          roles: {
            select: { id: true, name: true },
          },
        },
      });

      const mapped = projects
        .map((p) => {
          const allRoomMembers = p.rooms[0]?.members ?? [];
          const allRoomMembersByFlag =
            p.rooms.find((room) => room.isAllRoom)?.members ?? allRoomMembers;
          const memberCount = allRoomMembersByFlag.filter(
            (m) => m.userId !== p.leaderId,
          ).length;

          const isMember = allRoomMembersByFlag.some(
            (m) => m.userId === targetUserId,
          );
          const isFull =
            typeof p.maxMembers === "number" && memberCount >= p.maxMembers;
          const hasRequest = p.joinRequests.length > 0;

          // 1役割に複数人を割り当て可能にしたため、全役割を選択可能とする
          const availableRoles = p.roles.map((role) => ({
            id: role.id,
            name: role.name,
          }));

          return {
            id: p.id,
            publicId: p.publicId,
            name: p.name,
            memberCount,
            maxMembers: p.maxMembers ?? 0,
            status: p.status,
            isMember,
            isFull,
            hasRequest,
            availableRoles,
          };
        })
        .filter((p) => !p.isMember && !p.isFull && !p.hasRequest)
        .map((p) => ({
          publicId: p.publicId,
          name: p.name,
          memberCount: p.memberCount,
          maxMembers: p.maxMembers,
          availableRoles: p.availableRoles,
        }));

      initialScoutProjects = mapped;
    }
  }

  const initialRoom = {
    id: room.id,
    publicId: room.publicId,
    opponent: opponent
      ? {
          id: opponent.id,
          name: opponent.name,
          image: opponent.image,
          publicId: opponent.publicId,
        }
      : null,
  };

  return (
    <ChatArea
      currUser={currUser}
      roomPublicId={publicId}
      userEmojiStats={userEmojiStats}
      opponentUserId={opponentUserId ?? undefined}
      opponentPrivacyActions={opponentPrivacyActions ?? undefined}
      isBlocked={isBlocked}
      isBlockedBy={isBlockedBy}
      initialScoutProjects={initialScoutProjects ?? undefined}
      initialRoom={initialRoom}
      initialMessages={initialMessages}
    />
  );
}
