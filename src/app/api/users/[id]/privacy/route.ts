import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export type PrivacyState = {
  follow: boolean;
  order: boolean;
  scout: boolean;
  tip: boolean;
  showUserList: boolean;
};

const NAME_TO_KEY: Record<string, keyof PrivacyState> = {
  フォロー: "follow",
  オーダー: "order",
  スカウト: "scout",
  投げ銭: "tip",
  ユーザ一覧への表示: "showUserList",
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = parseInt(id, 10);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const categories = await prisma.privacyCategory.findMany({});
  const settings = await prisma.privacySetting.findMany({ where: { userId } });

  const state: PrivacyState = {
    follow: true,
    order: true,
    scout: true,
    tip: true,
    showUserList: true,
  };

  for (const cat of categories) {
    const key = NAME_TO_KEY[cat.name];
    if (!key) continue;
    const setting = settings.find((s) => s.privacyCategoryId === cat.id);
    if (setting) state[key] = setting.isEnabled;
  }

  return NextResponse.json(state);
}
