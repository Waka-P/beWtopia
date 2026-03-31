import type { PrismaClient } from "@/generated/prisma/client";

const INITIAL_TAGS = [
  "仕事",
  "学習",
  "家事",
  "健康",
  "お金",
  "趣味",
  "イベント",
  "生活",
  "買い物",
  "コミュニティ",
  "家族",
  "時間管理",
  "自己管理",
  "習慣づくり",
  "情報整理",
  "交流",
  "娯楽",
  "地域",
  "食事",
  "記録",
  "通知",
  "計画",
  "目標",
  "成長",
  "子育て",
  "健康維持",
  "メモ",
  "プログラミング",
  "テンプレート",
  "デザイン",
  "ノーコード",
  "ローコード",
  "JavaScript",
  "TypeScript",
  "React",
  "Next.js",
  "Vue.js",
  "Node.js",
  "Express",
  "Tailwind CSS",
  "GraphQL",
  "Redux Toolkit",
  "Django",
  "Ruby on Rails",
  "Spring Boot",
  "Firebase",
  "AWS",
];

export default async function seedTags(prisma: PrismaClient) {
  // 既存のタグを全て削除
  await prisma.tag.deleteMany();

  // 初期タグを一括挿入
  const tags = await prisma.tag.createMany({
    data: INITIAL_TAGS.map((name) => ({ name })),
    skipDuplicates: true,
  });

  console.log(`Seeded ${tags.count} tags`);

  return tags;
}
