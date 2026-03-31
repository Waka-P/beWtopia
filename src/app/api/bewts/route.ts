import { bewtsSchema } from "@/app/schemas/bewtsSchema";
import { auth } from "@/lib/auth";
import { genPublicId } from "@/lib/id";
import { prisma } from "@/lib/prisma";
import { normalizeUserInput } from "@/utils/normalize";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "ログインが必要です" },
        { status: 401 },
      );
    }

    const userId = Number(session.user.id);
    const body = await req.json();

    // バリデーション
    const validationResult = bewtsSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "バリデーションエラー", details: validationResult.error },
        { status: 400 },
      );
    }

    const data = validationResult.data;

    // スキルIDが全て存在するかチェック
    const foundSkills = await prisma.skill.findMany({
      where: { id: { in: data.skills } },
      select: { id: true },
    });
    if (foundSkills.length !== data.skills.length) {
      return NextResponse.json(
        { error: "存在しないスキルIDが含まれています" },
        { status: 400 },
      );
    }

    // トランザクションでプロジェクトと関連を作成
    const created = await prisma.$transaction(
      async (tx) => {
        // 1) プロジェクト本体（役割とスキルはネスト作成）
        const project = await tx.bewtsProject.create({
          data: {
            publicId: genPublicId(),
            name: normalizeUserInput(data.name),
            description: normalizeUserInput(data.description),
            maxMembers: data.memberCount,
            durationDays: data.durationDays,
            status: "RECRUITING",
            startedAt: null,
            leaderId: userId,
            // 役割（リーダーを先頭に自動追加）
            roles: {
              create: [
                {
                  name: "リーダー",
                  percentage: data.leaderSharePercentage,
                  isLeader: true,
                },
                ...data.roles.map((r) => ({
                  name: normalizeUserInput(r.name),
                  percentage: r.sharePercentage,
                })),
              ],
            },
            // スキル（既存 skill.id に接続）
            skills: {
              create: data.skills.map((skillId: number) => ({
                skill: { connect: { id: skillId } },
              })),
            },
          },
          include: { roles: true },
        });

        // 2) 全員用ルームを作成し、リーダーを参加させる
        const allRoom = await tx.bewtsRoom.create({
          data: {
            name: "全員",
            isAllRoom: true,
            projectId: project.id,
          },
        });

        await tx.bewtsRoomMember.create({
          data: { roomId: allRoom.id, userId },
        });

        // 3) 役割ごとのルームを作成
        const leaderRole = project.roles.find((role) => role.isLeader);
        if (!leaderRole) {
          throw new Error("リーダー役割が見つかりません");
        }

        const leaderRoleRoom = await tx.bewtsRoom.create({
          data: {
            name: normalizeUserInput(leaderRole.name),
            isAllRoom: false,
            projectId: project.id,
            roleId: leaderRole.id,
          },
        });

        await tx.bewtsRoomMember.create({
          data: { roomId: leaderRoleRoom.id, userId },
        });

        const nonLeaderRoles = project.roles.filter((role) => !role.isLeader);
        if (nonLeaderRoles.length > 0) {
          await tx.bewtsRoom.createMany({
            data: nonLeaderRoles.map((role) => ({
              name: normalizeUserInput(role.name),
              isAllRoom: false,
              projectId: project.id,
              roleId: role.id,
            })),
          });
        }

        // 4) リーダーに管理者権限を付与
        await tx.bewtsPermission.create({
          data: { projectId: project.id, userId, level: "ADMIN" },
        });

        return { project };
      },
      {
        maxWait: 10_000,
        timeout: 20_000,
      },
    );

    return NextResponse.json({
      message: "プロジェクトを作成しました",
      project: created.project,
    });
  } catch (error) {
    console.error("プロジェクト作成エラー:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "プロジェクトの作成に失敗しました",
      },
      { status: 500 },
    );
  }
}
