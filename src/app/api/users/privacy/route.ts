import { Prisma, type PrivacySetting } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// カテゴリ名 ⇔ UIキーのマッピング（スカウト対応）
const NAME_TO_KEY: Record<string, keyof PrivacyState> = {
  フォロー: "follow",
  オーダー: "order",
  スカウト: "scout",
  投げ銭: "tip",
  ユーザ一覧への表示: "showUserList",
};

const KEY_TO_NAME: Record<keyof PrivacyState, string> = Object.fromEntries(
  Object.entries(NAME_TO_KEY).map(([name, key]) => [key, name]),
) as Record<keyof PrivacyState, string>;

export type PrivacyState = {
  follow: boolean;
  order: boolean;
  scout: boolean;
  tip: boolean;
  showUserList: boolean;
};

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  // すべてのカテゴリを取得
  const categories = await prisma.privacyCategory.findMany({});

  // 該当ユーザの設定を取得
  const settings = await prisma.privacySetting.findMany({
    where: { userId },
  });

  // デフォルトは true
  const state: PrivacyState = {
    follow: true,
    order: true,
    scout: true,
    tip: true,
    showUserList: true,
  };

  // カテゴリ名からキーに落とし込み
  for (const cat of categories) {
    const key = NAME_TO_KEY[cat.name];
    if (!key) continue; // 未対応カテゴリはスキップ
    const setting = settings.find((s) => s.privacyCategoryId === cat.id);
    if (setting) state[key] = setting.isEnabled;
  }

  return NextResponse.json(state);
}

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.key !== "string" ||
    typeof body.enabled !== "boolean"
  ) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const key = body.key as keyof PrivacyState;
  const name = KEY_TO_NAME[key];
  if (!name) {
    return NextResponse.json({ error: "Unknown key" }, { status: 400 });
  }

  // 対応するカテゴリを取得
  const cat = await prisma.privacyCategory.findFirst({ where: { name } });
  if (!cat) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  let updated: PrivacySetting;
  try {
    updated = await prisma.privacySetting.upsert({
      where: {
        userId_privacyCategoryId: { userId, privacyCategoryId: cat.id },
      },
      update: { isEnabled: body.enabled },
      create: { userId, privacyCategoryId: cat.id, isEnabled: body.enabled },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      updated = await prisma.privacySetting.update({
        where: {
          userId_privacyCategoryId: { userId, privacyCategoryId: cat.id },
        },
        data: { isEnabled: body.enabled },
      });
    } else {
      throw e;
    }
  }

  return NextResponse.json({ ok: true, isEnabled: updated.isEnabled });
}
