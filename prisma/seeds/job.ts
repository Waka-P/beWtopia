import type { PrismaClient } from "@/generated/prisma/client";

const INITIAL_JOBS = [
  // エンジニア系
  "プログラマー",
  "Webエンジニア",
  "フロントエンド",
  "バックエンド",
  "インフラエンジニア",
  "SRE",
  "モバイル開発",
  "iOSエンジニア",
  "Android開発",
  "ゲーム開発",
  // クリエイター系
  "Webデザイナー",
  "UXデザイナー",
  "UIデザイナー",
  "グラフィック",
  "動画クリエイタ",
  "イラストレータ",
  // 企画・PM系
  "PM",
  "PdM",
  "ディレクター",
  "スクラムマスタ",
  // データ・マーケ系
  "データサイエン",
  "アナリスト",
  "マーケター",
  "SEO担当",
  // IT以外/その他
  "ライター",
  "講師",
  "学生",
  "フリーランス",
  "会社員",
  "自営業",
  "その他",
];

export default async function seedJobs(prisma: PrismaClient) {
  console.log("Seeding jobs...");

  // 既存の職業を全て削除
  await prisma.userJob.deleteMany();
  await prisma.job.deleteMany();

  const data = INITIAL_JOBS.map((name) => ({ name }));

  const jobs = await prisma.job.createMany({
    data,
    skipDuplicates: true,
  });

  console.log(`Seeded ${jobs.count} jobs`);

  return jobs;
}
