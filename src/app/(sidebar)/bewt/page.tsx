import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BewtForm } from "./BewtForm";

export const metadata: Metadata = {
  title: "ビュート",
};

async function getTags(userId: number) {
  // seeds で登録された全てのタグ
  const globalTags = await prisma.tag.findMany({
    where: {
      users: {
        none: {},
      },
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  // ユーザーが作成したカスタムタグ
  const userTags = await prisma.tag.findMany({
    where: {
      users: {
        some: {
          userId,
        },
      },
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  // 全てのタグを結合
  return [...globalTags, ...userTags];
}

async function getSystemTemplates() {
  const templates = await prisma.appTemplate.findMany({
    where: {
      userId: undefined, // システムテンプレート
    },
    select: {
      id: true,
      name: true,
      body: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  return templates.map((tem) => ({ ...tem, userId: null }));
}

export default async function BewtPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = Number.parseInt(session.user.id);
  const tags = await getTags(userId);
  const templates = await getSystemTemplates();

  return <BewtForm tags={tags} templates={templates} />;
}
