import { auth } from "@/lib/auth";
import { createNotificationWithUserSetting } from "@/lib/notification-settings";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const { id } = await context.params;
    const requestId = Number(id);

    if (!Number.isFinite(requestId)) {
      return NextResponse.json(
        { error: "Invalid request ID" },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = body?.action as
      | "accept"
      | "reject"
      | "undoAccept"
      | undefined;
    const chatMessagePublicId = body?.chatMessagePublicId as string | undefined;

    if (!action || !["accept", "reject", "undoAccept"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'accept', 'reject' or 'undoAccept'" },
        { status: 400 },
      );
    }

    const joinRequest = await prisma.bewtsJoinRequest.findUnique({
      where: { id: requestId },
      include: {
        project: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!joinRequest) {
      return NextResponse.json(
        { error: "Join request not found" },
        { status: 404 },
      );
    }

    // スカウトを受けた本人のみが応答可能
    if (joinRequest.userId !== user.id) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const now = Date.now();
    const UNDO_WINDOW_MS = 1 * 60 * 1000;

    if (action === "accept") {
      // PENDING のときだけ承諾可
      if (joinRequest.status !== "PENDING") {
        return NextResponse.json(
          { error: "このスカウトは既に処理されています" },
          { status: 400 },
        );
      }

      // 承諾前に人数上限チェック（確定 + 仮承諾 + 本件）
      const confirmedCount = await prisma.bewtsRoomMember.count({
        where: {
          room: { projectId: joinRequest.projectId, isAllRoom: true },
          userId: { not: joinRequest.project.leaderId },
        },
      });

      const cutoff = new Date(now - UNDO_WINDOW_MS);
      const pendingApprovedCount = await prisma.bewtsJoinRequest.count({
        where: {
          projectId: joinRequest.projectId,
          status: "APPROVED",
          updatedAt: { gte: cutoff },
        },
      });

      if (
        typeof joinRequest.project.maxMembers === "number" &&
        confirmedCount + pendingApprovedCount + 1 >
          joinRequest.project.maxMembers
      ) {
        return NextResponse.json(
          { error: "承諾できません — プロジェクトの募集人数を超えます" },
          { status: 400 },
        );
      }

      await prisma.bewtsJoinRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED" },
      });

      await createNotificationWithUserSetting(prisma, {
        userId: joinRequest.project.leaderId,
        actorId: user.id,
        type: "SCOUT",
        title: `${joinRequest.user.name}さんが${joinRequest.project.name}に参加しました`,
        message: null,
        redirectUrl: `/bewts/${joinRequest.project.publicId}`,
        bewtsProjectId: joinRequest.project.id,
        joinRequestId: requestId,
      });
    } else if (action === "reject") {
      // PENDING または APPROVED(仮承諾) から拒否にできる（ただし 1 分以内）
      if (joinRequest.status === "DECLINED") {
        return NextResponse.json(
          { error: "このスカウトは既に辞退されています" },
          { status: 400 },
        );
      }

      if (joinRequest.status === "APPROVED") {
        const updated = new Date(joinRequest.updatedAt).getTime();
        if (now - updated > UNDO_WINDOW_MS) {
          return NextResponse.json(
            { error: "承諾からの変更期限が過ぎています" },
            { status: 400 },
          );
        }
      }

      await prisma.bewtsJoinRequest.update({
        where: { id: requestId },
        data: { status: "DECLINED" },
      });

      await createNotificationWithUserSetting(prisma, {
        userId: joinRequest.project.leaderId,
        actorId: user.id,
        type: "SCOUT",
        title: `${joinRequest.user.name}さんが${joinRequest.project.name}への参加を拒否しました`,
        message: null,
        redirectUrl: `/bewts/${joinRequest.project.publicId}`,
        bewtsProjectId: joinRequest.project.id,
        joinRequestId: requestId,
      });
    } else if (action === "undoAccept") {
      // APPROVED から PENDING に戻す（1分以内のみ）
      if (joinRequest.status !== "APPROVED") {
        return NextResponse.json(
          { error: "承諾されていないスカウトは取り消せません" },
          { status: 400 },
        );
      }

      const updated = new Date(joinRequest.updatedAt).getTime();
      if (now - updated > UNDO_WINDOW_MS) {
        return NextResponse.json(
          { error: "承諾の取り消し期限が過ぎています" },
          { status: 400 },
        );
      }

      await prisma.bewtsJoinRequest.update({
        where: { id: requestId },
        data: { status: "PENDING" },
      });
    }

    // 対応するチャットメッセージがあれば、ステータス属性と更新時刻属性を更新しておく
    if (chatMessagePublicId) {
      const chatMessage = await prisma.chatMessage.findUnique({
        where: { publicId: chatMessagePublicId },
      });

      if (chatMessage?.content) {
        let content = chatMessage.content;

        let statusForAttr: "PENDING" | "APPROVED" | "DECLINED" | undefined;
        if (action === "accept") statusForAttr = "APPROVED";
        else if (action === "reject") statusForAttr = "DECLINED";
        else if (action === "undoAccept") statusForAttr = "PENDING";

        const updatedAtIso = new Date().toISOString();

        if (statusForAttr && content.includes("data-bewts-scout-status=")) {
          content = content.replace(
            /data-bewts-scout-status="(PENDING|APPROVED|DECLINED)"/,
            `data-bewts-scout-status="${statusForAttr}"`,
          );
        } else if (statusForAttr && content.includes('data-bewts-scout="1"')) {
          content = content.replace(
            'data-bewts-scout="1"',
            `data-bewts-scout="1" data-bewts-scout-status="${statusForAttr}"`,
          );
        }

        // updated-at 属性も更新（存在すれば置換、なければ追加）
        if (content.includes("data-bewts-scout-updated-at=")) {
          content = content.replace(
            /data-bewts-scout-updated-at="[^"]*"/,
            `data-bewts-scout-updated-at="${updatedAtIso}"`,
          );
        } else if (content.includes('data-bewts-scout="1"')) {
          content = content.replace(
            'data-bewts-scout="1"',
            `data-bewts-scout="1" data-bewts-scout-updated-at="${updatedAtIso}"`,
          );
        }

        await prisma.chatMessage.update({
          where: { id: chatMessage.id },
          data: { content },
        });
      }
    }

    // レスポンスの status には最新の joinRequest ステータスを返す
    const latest = await prisma.bewtsJoinRequest.findUnique({
      where: { id: requestId },
      select: { status: true },
    });

    return NextResponse.json({ success: true, status: latest?.status });
  } catch (error) {
    console.error("Bewts scout respond error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
