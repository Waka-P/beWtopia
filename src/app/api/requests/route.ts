import { requestSchemaAPI } from "@/app/schemas/requestSchema";
import { auth } from "@/lib/auth";
import { genPublicId } from "@/lib/id";
import { prisma } from "@/lib/prisma";
import { normalizeUserInput } from "@/utils/normalize";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
// リクエスト一覧取得
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const sort = searchParams.get("sort") || "newest";

    // 検索とソートを適用
    const requests = await prisma.request.findMany({
      where: query
        ? {
            OR: [
              { title: { contains: query } },
              { content: { contains: query } },
            ],
          }
        : undefined,
      include: {
        user: {
          select: {
            name: true,
            publicId: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                publicId: true,
              },
            },
          },
        },
        _count: {
          select: {
            reactions: true,
          },
        },
      },
      orderBy:
        sort === "oldest"
          ? { createdAt: "asc" }
          : sort === "popular"
            ? { reactions: { _count: "desc" } }
            : { createdAt: "desc" }, // newest
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("リクエスト取得エラー:", error);
    return NextResponse.json(
      { error: "リクエストの取得に失敗しました" },
      { status: 500 },
    );
  }
}

// リクエスト作成
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

    // バリデーション
    const result = requestSchemaAPI.safeParse(body);

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

    // リクエストを作成
    const request = await prisma.request.create({
      data: {
        publicId: genPublicId(),
        title: normalizeUserInput(data.title),
        content: normalizeUserInput(data.content),
        userId,
        tags: {
          create: data.tags.map((tagId) => ({
            tagId,
          })),
        },
      },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        user: {
          select: {
            name: true,
            publicId: true,
          },
        },
      },
    });

    return NextResponse.json(request, { status: 201 });
  } catch (error) {
    console.error("リクエスト作成エラー:", error);
    return NextResponse.json(
      { error: "リクエストの作成に失敗しました" },
      { status: 500 },
    );
  }
}
