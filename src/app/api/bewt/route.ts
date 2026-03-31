import { bewtSchemaAPI } from "@/app/schemas/bewtSchema";
import { auth } from "@/lib/auth";
import { genPublicId } from "@/lib/id";
import { prisma } from "@/lib/prisma";
import { normalizeUserInput } from "@/utils/normalize";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // ユーザー認証チェック
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const userId = parseInt(session.user.id, 10);

    // リクエストボディを取得
    const body = await req.json();

    // Zodでバリデーション
    const result = bewtSchemaAPI.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "不正なリクエストです",
          details: result.error,
        },
        { status: 400 },
      );
    }

    const data = result.data;

    let bewtsProjectId: number | null = null;
    if (data.bewtsProjectPublicId) {
      // ビューズプロジェクトの存在確認と権限チェック
      const project = await prisma.bewtsProject.findUnique({
        where: { publicId: data.bewtsProjectPublicId },
        select: { id: true, leaderId: true },
      });

      if (!project) {
        return NextResponse.json(
          { error: "指定されたビューズプロジェクトが見つかりません" },
          { status: 400 },
        );
      }

      const isLeader = project.leaderId === userId;
      let hasPermission = false;

      if (!isLeader) {
        const capability = await prisma.bewtsPermissionCapability.findFirst({
          where: {
            projectId: project.id,
            userId,
            capability: { in: ["MANAGE_APP", "PUBLISH", "ADMIN"] },
          },
          select: { id: true },
        });
        const levelPerm = await prisma.bewtsPermission.findUnique({
          where: {
            projectId_userId: { projectId: project.id, userId },
          },
          select: { level: true },
        });

        if (
          capability ||
          (levelPerm &&
            (levelPerm.level === "ADMIN" || levelPerm.level === "PUBLISHER"))
        ) {
          hasPermission = true;
        }
      }

      if (!isLeader && !hasPermission) {
        return NextResponse.json(
          { error: "ビューズから共同出品する権限がありません" },
          { status: 403 },
        );
      }

      bewtsProjectId = project.id;
    }

    // データベースに保存
    // まずタグを処理
    const tagIds: number[] = data.tags;

    // アプリをトランザクション内で作成
    const app = await prisma.$transaction(async (tx) => {
      // アプリ作成
      const appFileKeyRaw = (data as Record<string, unknown>).appFileKey;
      const appFileKey =
        typeof appFileKeyRaw === "string" ? appFileKeyRaw : null;
      const {
        name,
        description,
        summary,
        appFileSizeBytes,
        appIconUrl,
        imageUrls,
        salesPlan,
        trial,
        paymentMethod,
      } = data;
      const trialFileKeyRaw = (trial as Record<string, unknown>).trialFileKey;
      const trialFileKey =
        typeof trialFileKeyRaw === "string" ? trialFileKeyRaw : null;

      const newApp = await tx.app.create({
        data: {
          publicId: genPublicId(),
          name: normalizeUserInput(name),
          description: normalizeUserInput(description),
          summary: normalizeUserInput(summary),
          rating: 0,
          // store object key + size (no public URL)
          appFileKey: appFileKey,
          appFileSizeBytes: appFileSizeBytes,
          appIconUrl: appIconUrl || null,
          owner: {
            connect: { id: userId },
          },
          ...(bewtsProjectId
            ? {
                bewtsProject: {
                  connect: { id: bewtsProjectId },
                },
              }
            : {}),
          tags: {
            create: tagIds.map((tagId) => ({
              tagId,
            })),
          },
          images: {
            create: imageUrls.map((url, index) => ({
              imageUrl: url,
              displayOrder: index + 1,
            })),
          },
          salesPlans: {
            create: [
              ...(salesPlan.oneTimeEnabled && salesPlan.oneTimePrice
                ? [
                    {
                      salesFormat: "P" as const,
                      price: salesPlan.oneTimePrice,
                    },
                  ]
                : []),
              ...(salesPlan.monthlyEnabled && salesPlan.monthlyPrice
                ? [
                    {
                      salesFormat: "S" as const,
                      price: salesPlan.monthlyPrice,
                    },
                  ]
                : []),
            ],
          },
          ...(trial.trialEnabled
            ? {
                trial: {
                  create: {
                    trialDays: trial.trialDays,
                    trialFileKey,
                  },
                },
              }
            : {}),
          paymentMethods: {
            create: [
              ...(paymentMethod.cardEnabled ? [{ method: "C" as const }] : []),
              ...(paymentMethod.wCoinEnabled ? [{ method: "W" as const }] : []),
            ],
          },
        },
      });

      return newApp;
    });

    return NextResponse.json({
      success: true,
      appId: app.publicId,
      message: "アプリを出品しました",
    });
  } catch (error) {
    console.error("出品エラー:", error);
    return NextResponse.json(
      { error: "出品処理中にエラーが発生しました" },
      { status: 500 },
    );
  }
}
