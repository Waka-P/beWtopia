import { auth } from "@/lib/auth";
import {
  defaultCapabilitiesByLevel,
  normalizeCapabilities,
} from "@/lib/bewtsCapabilities";
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
    select: { id: true, name: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const { id } = await context.params;
    const requestId = parseInt(id);

    if (Number.isNaN(requestId)) {
      return NextResponse.json(
        { error: "Invalid request ID" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { action, roleId, roleIds, capabilities } = body;

    const toRoleId = (value: unknown): number | null => {
      const n = Number(value);
      return Number.isInteger(n) && n > 0 ? n : null;
    };

    const normalizedRoleIds = Array.isArray(roleIds)
      ? Array.from(
          new Set(
            roleIds
              .map((value: unknown) => toRoleId(value))
              .filter((value): value is number => value !== null),
          ),
        )
      : (() => {
          const single = toRoleId(roleId);
          return single ? [single] : [];
        })();

    const normalizedCapabilities = normalizeCapabilities(
      Array.isArray(capabilities)
        ? capabilities
        : defaultCapabilitiesByLevel("MEMBER"),
    );

    if (!action || !["approve", "decline", "undo"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'approve', 'decline' or 'undo'" },
        { status: 400 },
      );
    }

    // 参加申請を取得
    const joinRequest = await prisma.bewtsJoinRequest.findUnique({
      where: { id: requestId },
      include: {
        project: {
          include: {
            leader: true,
            rooms: true,
          },
        },
        user: {
          select: { id: true, name: true },
        },
        roleAssignments: {
          select: { roleId: true },
        },
        capabilityAssignments: {
          select: { capability: true },
        },
      },
    });

    if (!joinRequest) {
      return NextResponse.json(
        { error: "Join request not found" },
        { status: 404 },
      );
    }

    // 操作ごとの権限チェック（capability 優先、旧 level は後方互換として許容）
    const actorLevelAdmin = Boolean(
      await prisma.bewtsPermission.findFirst({
        where: {
          projectId: joinRequest.projectId,
          userId: user.id,
          level: "ADMIN",
        },
      }),
    );
    const actorCapabilities = await prisma.bewtsPermissionCapability.findMany({
      where: {
        projectId: joinRequest.projectId,
        userId: user.id,
      },
      select: { capability: true },
    });
    const actorCapabilitySet = new Set(
      actorCapabilities.map((cap) => cap.capability),
    );
    const actorCanApprove =
      actorLevelAdmin ||
      actorCapabilitySet.has("ADMIN") ||
      actorCapabilitySet.has("APPROVE_JOIN_REQUEST") ||
      actorCapabilitySet.has("GRANT_PERMISSION");
    const actorCanDecline =
      actorLevelAdmin ||
      actorCapabilitySet.has("ADMIN") ||
      actorCapabilitySet.has("DECLINE_JOIN_REQUEST") ||
      actorCapabilitySet.has("GRANT_PERMISSION");
    const actorCanUndoByPermission =
      actorLevelAdmin ||
      actorCapabilitySet.has("ADMIN") ||
      actorCapabilitySet.has("UNDO_JOIN_APPROVAL");
    const actorIsLeader = joinRequest.project.leaderId === user.id;

    if (action === "undo") {
      if (!(actorIsLeader || actorCanUndoByPermission)) {
        return NextResponse.json(
          { error: "権限がありません" },
          { status: 403 },
        );
      }

      // undo 操作
      const UNDO_WINDOW_MS = 1 * 60 * 1000;

      // 未処理のものを取り消すことはできない
      if (joinRequest.status === "PENDING") {
        return NextResponse.json(
          { error: "この申請は処理されていません" },
          { status: 400 },
        );
      }

      // 取り消し期限チェック
      const elapsed = Date.now() - new Date(joinRequest.updatedAt).getTime();
      if (elapsed > UNDO_WINDOW_MS) {
        return NextResponse.json(
          { error: "取り消し期限が過ぎています" },
          { status: 400 },
        );
      }

      // 取り消し：ステータスを PENDING に戻し、承認時に付与したメンバー/権限を削除する
      await prisma.$transaction(async (tx) => {
        await tx.bewtsJoinRequest.update({
          where: { id: requestId },
          data: { status: "PENDING" },
        });

        if (joinRequest.status === "APPROVED") {
          // 削除対象の room ids
          const roomIds = joinRequest.project.rooms.map((r) => r.id);

          // ルームメンバー削除
          if (roomIds.length > 0) {
            await tx.bewtsRoomMember.deleteMany({
              where: { roomId: { in: roomIds }, userId: joinRequest.userId },
            });
          }

          // 承認時に付与された権限を削除
          await tx.bewtsPermission.deleteMany({
            where: {
              projectId: joinRequest.projectId,
              userId: joinRequest.userId,
            },
          });

          await tx.bewtsPermissionCapability.deleteMany({
            where: {
              projectId: joinRequest.projectId,
              userId: joinRequest.userId,
            },
          });
        }

        // 申請者へ通知
        await createNotificationWithUserSetting(tx, {
          userId: joinRequest.userId,
          actorId: user.id,
          type: "SYSTEM",
          title: `「${joinRequest.project.name}」の申請処理が元に戻されました`,
          message: `プロジェクトリーダーが申請の取り消しを行いました。`,
          redirectUrl: `/bewts/${joinRequest.project.publicId}`,
          bewtsProjectId: joinRequest.project.id,
          joinRequestId: requestId,
        });
      });

      return NextResponse.json({ success: true, message: "取り消しました" });
    }

    // ここからは承認／見送り（approve / decline）
    // 承認／見送りはそれぞれ capability で制御
    if (action === "approve" && !actorCanApprove) {
      return NextResponse.json(
        { error: "権限がありません（承認権限が必要です）" },
        { status: 403 },
      );
    }
    if (action === "decline" && !actorCanDecline) {
      return NextResponse.json(
        { error: "権限がありません（見送り権限が必要です）" },
        { status: 403 },
      );
    }

    // 既に処理済みの場合はエラー（承認/辞退時のみ）
    if (joinRequest.status !== "PENDING") {
      return NextResponse.json(
        { error: "この申請は既に処理されています" },
        { status: 400 },
      );
    }

    if (action === "approve") {
      if (normalizedRoleIds.length === 0) {
        return NextResponse.json(
          { error: "承認時は役割の指定が必須です" },
          { status: 400 },
        );
      }

      // 承認前に人数上限チェックを行う（確定済メンバー + 現在の仮承認数 + 本件 が定員を超えないこと）
      const UNDO_WINDOW_MS = 1 * 60 * 1000;
      const cutoff = new Date(Date.now() - UNDO_WINDOW_MS);

      // 現在確定しているメンバー数（募集枠に該当する "確定メンバー" — リーダーは除外）
      const confirmedCount = await prisma.bewtsRoomMember.count({
        where: {
          room: { projectId: joinRequest.projectId, isAllRoom: true },
          userId: { not: joinRequest.project.leaderId },
        },
      });

      // 既に仮承認されている件数（Undo ウィンドウ内）
      const pendingApprovedCount = await prisma.bewtsJoinRequest.count({
        where: {
          projectId: joinRequest.projectId,
          status: "APPROVED",
          updatedAt: { gte: cutoff },
        },
      });

      // maxMembers が設定されているなら上限チェック（超える場合は弾く）
      const projectMax = joinRequest.project.maxMembers;
      if (
        typeof projectMax === "number" &&
        confirmedCount + pendingApprovedCount + 1 > projectMax
      ) {
        return NextResponse.json(
          { error: "承認できません — プロジェクトの募集人数を超えます" },
          { status: 400 },
        );
      }

      const validRoles = await prisma.bewtsRole.findMany({
        where: {
          id: { in: normalizedRoleIds },
          projectId: joinRequest.projectId,
          isLeader: false,
        },
        select: { id: true },
      });

      if (validRoles.length !== normalizedRoleIds.length) {
        return NextResponse.json(
          { error: "指定された役割が無効です（リーダー役割は指定できません）" },
          { status: 400 },
        );
      }

      // ステータスを APPROVED にする（ただし、メンバー/権限の恒久付与は finalizer が行う）
      await prisma.$transaction(async (tx) => {
        await tx.bewtsJoinRequestRole.deleteMany({
          where: { joinRequestId: requestId },
        });

        await tx.bewtsJoinRequestRole.createMany({
          data: normalizedRoleIds.map((selectedRoleId: number) => ({
            joinRequestId: requestId,
            roleId: selectedRoleId,
          })),
        });

        await tx.bewtsJoinRequestCapability.deleteMany({
          where: { joinRequestId: requestId },
        });

        await tx.bewtsJoinRequestCapability.createMany({
          data: normalizedCapabilities.map((capability) => ({
            joinRequestId: requestId,
            capability,
          })),
        });

        await tx.bewtsJoinRequest.update({
          where: { id: requestId },
          data: {
            status: "APPROVED",
            roleId: normalizedRoleIds[0] ?? null,
          },
        });
      });

      // 申請者に通知（「仮承認」通知）
      await createNotificationWithUserSetting(prisma, {
        userId: joinRequest.userId,
        actorId: user.id,
        type: "BEWTS_JOIN_APPROVED",
        title: `「${joinRequest.project.name}」への参加が承認されました（確定待ち）`,
        message: `承認が行われました。1分後に処理が確定します（取り消し可能）。`,
        redirectUrl: `/bewts/${joinRequest.project.publicId}`,
        bewtsProjectId: joinRequest.project.id,
        joinRequestId: requestId,
      });

      return NextResponse.json({
        success: true,
        message: "参加申請を承認しました（確定待ち）",
      });
    } else {
      // 辞退処理
      await prisma.$transaction(async (tx) => {
        await tx.bewtsJoinRequest.update({
          where: { id: requestId },
          data: { status: "DECLINED" },
        });

        // 申請者に通知
        await createNotificationWithUserSetting(tx, {
          userId: joinRequest.userId,
          actorId: user.id,
          type: "BEWTS_JOIN_DECLINED",
          title: `「${joinRequest.project.name}」への参加申請について`,
          message: `申し訳ございませんが、今回は参加を見送らせていただくことになりました。`,
          redirectUrl: `/bewts/${joinRequest.project.publicId}`,
          bewtsProjectId: joinRequest.project.id,
          joinRequestId: requestId,
        });
      });

      return NextResponse.json({
        success: true,
        message: "参加申請を見送りました",
      });
    }
  } catch (error) {
    console.error("Join request action error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
