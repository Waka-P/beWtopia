import type { PrismaClient } from "@/generated/prisma/client";

const INITIAL_PRIVACY_CATEGORIES: { name: string }[] = [
  { name: "フォロー" },
  { name: "オーダー" },
  { name: "スカウト" },
  { name: "投げ銭" },
  { name: "ユーザ一覧への表示" },
];

export default async function seedPrivacyCategories(prisma: PrismaClient) {
  // 既存カテゴリを全削除（関連設定はCASCADEで削除）
  await prisma.privacySetting.deleteMany();
  await prisma.privacyCategory.deleteMany();

  const res = await prisma.privacyCategory.createMany({
    data: INITIAL_PRIVACY_CATEGORIES,
    skipDuplicates: true,
  });

  console.log(`Seeded ${res.count} privacy categories`);
  return res;
}
