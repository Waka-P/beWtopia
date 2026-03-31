import type { PrismaClient } from "@/generated/prisma/client";

const INITIAL_SKILLS = [
  // === フロントエンド ===
  "HTML",
  "CSS",
  "JavaScript",
  "TypeScript",
  "React",
  "Next.js",
  "Vue.js",
  "Nuxt.js",
  "Svelte",
  "Tailwind CSS",
  "Bootstrap",
  "Storybook",

  // === バックエンド ===
  "Node.js",
  "Express",
  "NestJS",
  "Python",
  "Django",
  "FastAPI",
  "Ruby",
  "Ruby on Rails",
  "Go",
  "Gin",
  "PHP",
  "Laravel",
  "Java",
  "Spring Boot",

  // === モバイル ===
  "Swift",
  "Kotlin",
  "Flutter",
  "React Native",
  "iOSアプリ開発",
  "Androidアプリ開発",

  // === インフラ・DevOps ===
  "Docker",
  "Docker Compose",
  "Kubernetes",
  "AWS",
  "GCP",
  "Azure",
  "Firebase",
  "Vercel",
  "Cloudflare",
  "Terraform",
  "CI/CD",
  "GitHub Actions",

  // === データ・DB ===
  "MySQL",
  "PostgreSQL",
  "SQLite",
  "MongoDB",
  "Redis",
  "Prisma",
  "ORM設計",
  "データ分析",
  "BigQuery",

  // === AI・データサイエンス ===
  "機械学習",
  "深層学習",
  "生成AI",
  "OpenAI API",
  "画像認識",
  "自然言語処理",

  // === デザイン ===
  "UI/UX",
  "Figma",
  "Adobe XD",
  "Photoshop",
  "Illustrator",
  "Webデザイン",
  "デザインシステム",

  // === プロダクト・ビジネス寄り ===
  "要件定義",
  "仕様設計",
  "プロダクト設計",
  "MVP開発",
  "スタートアップ開発",
  "SaaS開発",
  "決済連携（Stripe等）",
  "認証・認可",
  "SEO",
  "アクセス解析",

  // === その他・横断 ===
  "Git",
  "GitHub",
  "テスト自動化",
  "E2Eテスト",
  "パフォーマンス改善",
  "セキュリティ",
  "スクレイピング",
  "API設計",
  "GraphQL",
  "WebSocket",
];

export default async function seedSkills(prisma: PrismaClient) {
  console.log("Seeding skills...");

  await prisma.userSkill.deleteMany();
  await prisma.skill.deleteMany();

  const data = INITIAL_SKILLS.map((name) => ({ name }));

  const res = await prisma.skill.createMany({ data, skipDuplicates: true });
  console.log(`Seeded ${res.count} skills`);
  return res;
}
