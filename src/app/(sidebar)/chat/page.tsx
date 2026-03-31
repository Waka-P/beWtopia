import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "チャット",
};

export default async function ChatPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return redirect("/login");

  const userId = Number(session.user.id);

  // ルーム一覧（自分が isHidden: false のメンバーとして参加しているルームのみ）
  const rooms = await prisma.chatRoom.findMany({
    where: {
      members: {
        some: {
          userId,
          isHidden: false, // ← 自分が非表示にしていないルームのみ
        },
      },
    },
    include: {
      members: {
        select: {
          userId: true,
          deletedAt: true,
        },
      },
    },
  });

  // 自分が deleted していても、その deletedAt より後にメッセージがあれば再表示する
  // deletedAt を考慮した最新メッセージの有無を各ルームごとに確認
  const visibleRoomsPromises = rooms.map(async (r) => {
    const member = r.members.find((m) => m.userId === userId);
    if (!member) return null;

    const deletedAt = member.deletedAt;

    // deletedAt がない場合は表示
    if (!deletedAt) return r;

    // deletedAt がある場合、deletedAt より後のメッセージがあるかチェック
    const messageAfterDelete = await prisma.chatMessage.findFirst({
      where: {
        roomId: r.id,
        createdAt: { gt: deletedAt },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    // deletedAt より後のメッセージがあれば表示
    return messageAfterDelete ? r : null;
  });

  const visibleRoomsResults = await Promise.all(visibleRoomsPromises);
  const visibleRooms = visibleRoomsResults.filter(
    (r) => r !== null,
  ) as typeof rooms;

  if (visibleRooms.length === 0) {
    // ルームがなければ通常のプレースホルダを表示
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "#7a8a99",
        }}
      >
        <p>チャットを選択または検索してメッセージを開始します</p>
      </div>
    );
  }

  // 各ルームの最後のアクティビティ日時（message.createdAt / reaction.createdAt / read.readAt の最大値）を計算
  const roomActivityPromises = visibleRooms.map(async (r) => {
    const member = r.members.find((m) => m.userId === userId);
    const deletedAt = member?.deletedAt;

    // deletedAt を考慮して最新メッセージを取得
    const lastMessage = await prisma.chatMessage.findFirst({
      where: {
        roomId: r.id,
        ...(deletedAt ? { createdAt: { gt: deletedAt } } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    const lastMessageAt = lastMessage?.createdAt
      ? new Date(lastMessage.createdAt).getTime()
      : 0;

    const lastReaction = await prisma.chatMessageReaction.findFirst({
      where: {
        message: {
          roomId: r.id,
          ...(deletedAt ? { createdAt: { gt: deletedAt } } : {}),
        },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const lastReactionAt = lastReaction?.createdAt
      ? new Date(lastReaction.createdAt).getTime()
      : 0;

    const lastRead = await prisma.chatMessageRead.findFirst({
      where: {
        message: {
          roomId: r.id,
          ...(deletedAt ? { createdAt: { gt: deletedAt } } : {}),
        },
      },
      orderBy: { readAt: "desc" },
      select: { readAt: true },
    });
    const lastReadAt = lastRead?.readAt
      ? new Date(lastRead.readAt).getTime()
      : 0;

    const lastActivity = Math.max(lastMessageAt, lastReactionAt, lastReadAt, 0);
    return { room: r, lastActivity };
  });

  const activities = await Promise.all(roomActivityPromises);
  activities.sort((a, b) => b.lastActivity - a.lastActivity);

  const mostRecent = activities[0];
  if (mostRecent?.room) {
    // 最後にアクションがあったルームへリダイレクト
    return redirect(`/chat/${mostRecent.room.publicId}`);
  }

  // フォールバック（あり得ないが念のため）
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        color: "#7a8a99",
      }}
    >
      <p>チャットを選択または検索してメッセージを開始します</p>
    </div>
  );
}
