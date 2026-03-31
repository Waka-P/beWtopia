import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { truncate } from "@/utils/truncate";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { TrialClient } from "./TrialClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  if (!publicId || typeof publicId !== "string") notFound();

  const app = await prisma.app.findUnique({
    where: { publicId },
  });

  if (!app) {
    notFound();
  }
  return {
    title: `${truncate(app.name, 15)}のお試し体験`,
  };
}

type TrialPageProps = {
  params: Promise<{
    publicId: string;
  }>;
};

export default async function TrialPage({ params }: TrialPageProps) {
  const { publicId } = await params;

  if (!publicId || typeof publicId !== "string") {
    notFound();
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    // ログインしていない場合はログイン画面へリダイレクト
    redirect(`/login?callbackUrl=/apps/${encodeURIComponent(publicId)}/trial`);
  }

  const app = await prisma.app.findUnique({
    where: { publicId },
    select: {
      id: true,
      name: true,
      trial: {
        select: {
          trialDays: true,
          trialFileKey: true,
        },
      },
    },
  });

  if (!app || !app.trial || !app.trial.trialFileKey) {
    notFound();
  }

  const userId = Number(session.user.id);

  // ユーザーごとのお試し開始日時を取得（なければ作成）
  const usage = await prisma.appTrialUsage.upsert({
    where: {
      appId_userId: {
        appId: app.id,
        userId,
      },
    },
    update: {},
    create: {
      appId: app.id,
      userId,
    },
  });

  const trialEndAt = new Date(
    usage.startedAt.getTime() + app.trial.trialDays * 24 * 60 * 60 * 1000,
  );

  if (new Date() >= trialEndAt) {
    // お試し期間が終了している場合は 404 を返す
    notFound();
  }

  const trialSrc = `/api/apps/${encodeURIComponent(publicId)}/trial/index.html`;

  return <TrialClient publicId={publicId} trialSrc={trialSrc} />;
}
