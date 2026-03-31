import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leaderId = Number(session.user.id);

  const url = new URL(req.url);
  const targetUserIdParam = url.searchParams.get("targetUserId");

  if (!targetUserIdParam) {
    return NextResponse.json(
      { error: "targetUserId is required" },
      { status: 400 },
    );
  }

  const targetUserId = Number(targetUserIdParam);
  if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
    return NextResponse.json(
      { error: "targetUserId must be a positive number" },
      { status: 400 },
    );
  }

  if (targetUserId === leaderId) {
    return NextResponse.json(
      { error: "自分自身をスカウトすることはできません" },
      { status: 400 },
    );
  }

  // 対象ユーザーが存在するか確認
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // リーダーであるビューズプロジェクト一覧を取得
  const projects = await prisma.bewtsProject.findMany({
    where: {
      leaderId,
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

  const result = projects
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
        maxMembers: p.maxMembers,
        status: p.status,
        isMember,
        isFull,
        hasRequest,
        availableRoles,
      };
    })
    // 対象ユーザーが既にメンバー / 募集上限に達している / 既に申請 or スカウト済みのプロジェクトは除外
    .filter((p) => !p.isMember && !p.isFull && !p.hasRequest);

  return NextResponse.json(result);
}
