import { auth } from "@/lib/auth";
import { createNotificationWithUserSetting } from "@/lib/notification-settings";
import { prisma } from "@/lib/prisma";
import { normalizeUserInput } from "@/utils/normalize";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leaderId = Number(session.user.id);

  try {
    const body = await request.json();
    const { projectPublicId, targetUserId, message, roleId, roleIds } =
      body ?? {};
    const normalizedMessage =
      typeof message === "string" ? normalizeUserInput(message) : null;

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

    if (!projectPublicId) {
      return NextResponse.json(
        { error: "projectPublicId is required" },
        { status: 400 },
      );
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: "targetUserId is required" },
        { status: 400 },
      );
    }

    const targetIdNum = Number(targetUserId);
    if (!Number.isFinite(targetIdNum) || targetIdNum <= 0) {
      return NextResponse.json(
        { error: "targetUserId must be a positive number" },
        { status: 400 },
      );
    }

    if (targetIdNum === leaderId) {
      return NextResponse.json(
        { error: "自分自身をスカウトすることはできません" },
        { status: 400 },
      );
    }

    // ターゲットユーザーを取得
    const targetUser = await prisma.user.findUnique({
      where: { id: targetIdNum },
      select: { id: true, name: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // プロジェクトを取得（リーダー権限チェックもここで行う）
    const project = await prisma.bewtsProject.findUnique({
      where: { publicId: projectPublicId },
      include: {
        leader: {
          select: { id: true, name: true },
        },
        joinRequests: {
          where: { userId: targetIdNum },
          select: { id: true, status: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // リーダー本人のみスカウト可能
    if (project.leaderId !== leaderId) {
      return NextResponse.json(
        { error: "このプロジェクトのリーダーのみがスカウトできます" },
        { status: 403 },
      );
    }

    // 既に（任意のステータスで）参加申請 or スカウト済みかチェック
    if (project.joinRequests.length > 0) {
      return NextResponse.json(
        { error: "このユーザーには既に参加申請またはスカウトが存在します" },
        { status: 400 },
      );
    }

    // 対象ユーザーが既にメンバーかチェック
    const isMember = await prisma.bewtsRoomMember.findFirst({
      where: {
        userId: targetIdNum,
        room: {
          projectId: project.id,
          isAllRoom: true,
        },
      },
    });

    if (isMember) {
      return NextResponse.json(
        { error: "対象ユーザーは既にプロジェクトのメンバーです" },
        { status: 400 },
      );
    }

    // 募集上限に達している場合はスカウトできない
    const confirmedCount = await prisma.bewtsRoomMember.count({
      where: {
        room: { projectId: project.id, isAllRoom: true },
        // leader を除外してカウント（募集枠はリーダーに含まれないため）
        userId: { not: project.leaderId },
      },
    });

    if (
      typeof project.maxMembers === "number" &&
      confirmedCount >= project.maxMembers
    ) {
      return NextResponse.json(
        { error: "このプロジェクトは既に募集人数に達しています" },
        { status: 400 },
      );
    }

    // 希望役割が指定されている場合は検証（役割がプロジェクトに属すること）
    if (normalizedRoleIds.length > 0) {
      const roles = await prisma.bewtsRole.findMany({
        where: {
          id: { in: normalizedRoleIds },
          projectId: project.id,
          isLeader: false,
        },
        select: { id: true },
      });

      if (roles.length !== normalizedRoleIds.length) {
        return NextResponse.json(
          { error: "指定された役割が無効です（リーダー役割は指定できません）" },
          { status: 400 },
        );
      }
    }

    // joinRequest レコードを作成
    const joinRequest = await prisma.bewtsJoinRequest.create({
      data: {
        userId: targetUser.id,
        projectId: project.id,
        message: normalizedMessage || null,
        status: "PENDING",
        roleId: normalizedRoleIds[0] ?? null,
        roleAssignments:
          normalizedRoleIds.length > 0
            ? {
                createMany: {
                  data: normalizedRoleIds.map((id: number) => ({ roleId: id })),
                },
              }
            : undefined,
      },
    });

    // 対象ユーザーに SCOUT 通知を送信
    await createNotificationWithUserSetting(prisma, {
      userId: targetUser.id,
      actorId: leaderId,
      type: "SCOUT",
      title: `${project.leader.name}さんから「${project.name}」へのスカウトが届きました`,
      message: normalizedMessage || null,
      redirectUrl: `/bewts/${project.publicId}`,
      bewtsProjectId: project.id,
      joinRequestId: joinRequest.id,
    });

    return NextResponse.json({ success: true, requestId: joinRequest.id });
  } catch (error) {
    console.error("Bewts scout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
