import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  status: z.enum(["RECRUITING", "DEVELOPING", "COMPLETED"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id)
      return NextResponse.json(
        { error: "ログインが必要です" },
        { status: 401 },
      );

    const userId = Number(session.user.id);
    const { publicId } = await params;

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "不正なリクエスト", details: parsed.error },
        { status: 400 },
      );

    const { status } = parsed.data;

    const project = await prisma.bewtsProject.findUnique({
      where: { publicId },
      select: { id: true, leaderId: true, status: true, startedAt: true },
    });

    if (!project)
      return NextResponse.json(
        { error: "プロジェクトが見つかりません" },
        { status: 404 },
      );

    // 権限チェック: リーダー、または MANAGE_PROJECT 権限を持つユーザー
    const isLeader = project.leaderId === userId;

    let hasPermission = false;
    if (!isLeader) {
      const capability = await prisma.bewtsPermissionCapability.findFirst({
        where: {
          projectId: project.id,
          userId,
          capability: { in: ["MANAGE_PROJECT", "ADMIN"] },
        },
        select: { id: true },
      });
      const levelPerm = await prisma.bewtsPermission.findUnique({
        where: { projectId_userId: { projectId: project.id, userId } },
        select: { level: true },
      });
      if (
        capability ||
        (levelPerm &&
          (levelPerm.level === "ADMIN" || levelPerm.level === "PUBLISHER"))
      )
        hasPermission = true;
    }

    if (!isLeader && !hasPermission) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    // 更新: DEVELOPING に変更する場合は startedAt を設定する（未設定時）
    const updateData: Prisma.BewtsProjectUpdateInput = { status };
    if (status === "DEVELOPING" && !project.startedAt) {
      updateData.startedAt = new Date();
    }

    const updated = await prisma.bewtsProject.update({
      where: { id: project.id },
      data: updateData,
    });

    return NextResponse.json({
      message: "ステータスを更新しました",
      project: {
        publicId: updated.publicId,
        status: updated.status,
        startedAt: updated.startedAt,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
