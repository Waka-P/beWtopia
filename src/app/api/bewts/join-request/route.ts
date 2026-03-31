import { auth } from "@/lib/auth";
import { createNotificationWithUserSetting } from "@/lib/notification-settings";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function POST(request: NextRequest) {
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
    const body = await request.json();
    const { projectPublicId, message, roleId, roleIds } = body;

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

    // プロジェクトを取得
    const project = await prisma.bewtsProject.findUnique({
      where: { publicId: projectPublicId },
      include: {
        leader: {
          select: { id: true, name: true },
        },
        joinRequests: {
          where: { userId: user.id },
          select: { id: true, status: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // 既に（任意のステータスで）参加申請済みかチェック — 一度申請したら再申請不可
    if (project.joinRequests.length > 0) {
      return NextResponse.json(
        { error: "既に参加申請を送信済みです" },
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

    // リーダー本人は申請できない
    if (project.leaderId === user.id) {
      return NextResponse.json(
        { error: "プロジェクトリーダーは参加申請できません" },
        { status: 400 },
      );
    }

    // 既にメンバーかチェック
    const isMember = await prisma.bewtsRoomMember.findFirst({
      where: {
        userId: user.id,
        room: {
          projectId: project.id,
          isAllRoom: true,
        },
      },
    });

    if (isMember) {
      return NextResponse.json(
        { error: "既にプロジェクトのメンバーです" },
        { status: 400 },
      );
    }

    // 募集上限に達している場合は申請できない
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
        { error: "募集人数に達しています" },
        { status: 400 },
      );
    }

    // 参加申請を作成
    const joinRequest = await prisma.bewtsJoinRequest.create({
      data: {
        userId: user.id,
        projectId: project.id,
        message: message || null,
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

    // リーダーに通知を送信
    await createNotificationWithUserSetting(prisma, {
      userId: project.leaderId,
      actorId: user.id,
      type: "BEWTS_JOIN_REQUEST",
      title: `${user.name}さんが「${project.name}」への参加を申請しました`,
      message: message || null,
      redirectUrl: `/bewts/${project.publicId}`,
      bewtsProjectId: project.id,
      joinRequestId: joinRequest.id,
    });

    return NextResponse.json({ success: true, requestId: joinRequest.id });
  } catch (error) {
    console.error("Join request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
