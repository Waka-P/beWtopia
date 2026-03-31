import RatingSummary from "@/app/(sidebar)/components/RatingSummary";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { truncate } from "@/utils/truncate";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import AppNameMarquee from "../components/AppNameMarquee";
import ReviewFormClient from "../ReviewFormClient";
import styles from "./page.module.scss";

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
    title: `${truncate(app.name, 15)}のレビューを編集`,
  };
}

type PageProps = {
  params: Promise<{
    publicId: string;
  }>;
};

export default async function ReviewEditPage({ params }: PageProps) {
  const { publicId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !session.user?.id) {
    notFound();
  }

  const userId = Number(session.user.id);

  const app = await prisma.app.findUnique({
    where: { publicId },
    include: {
      reviews: {
        select: {
          rating: true,
        },
      },
      _count: {
        select: {
          reviews: true,
        },
      },
    },
  });
  if (!app) {
    notFound();
  }

  const review = await prisma.appReview.findFirst({
    where: { appId: app.id, userId },
    select: { id: true, rating: true, body: true },
  });

  if (!review) {
    notFound();
  }

  // レビュー集計: [5星,4星,3星,2星,1星]
  const reviewDistribution: [number, number, number, number, number] = (() => {
    const counts = [0, 0, 0, 0, 0];
    if (!app || !app.reviews)
      return counts as [number, number, number, number, number];
    for (const r of app.reviews) {
      const star = Math.max(1, Math.min(5, Math.round(r.rating.toNumber())));
      // 5星はindex 0、1星はindex 4
      counts[5 - star] += 1;
    }
    return counts as [number, number, number, number, number];
  })();

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>レビューを編集</h1>
      <div className={styles.body}>
        <div className={styles.appInfo}>
          <Link href={`/apps/${publicId}`} className={styles.appLink}>
            <span className={styles.appIconWrapper}>
              <Image
                src={app.appIconUrl || "/images/icon-default.png"}
                alt={`${app.name}のアイコン`}
                fill
                className={styles.appIcon}
              />
            </span>
            <AppNameMarquee
              name={app.name}
              className={styles.appName}
              marqueeReadyClassName={styles.marqueeReady}
              marqueeTextClassName={styles.marqueeText}
            />
          </Link>
          <RatingSummary
            average={app?.rating.toNumber() ?? 0}
            totalCount={app?._count?.reviews ?? app?.reviews?.length ?? 0}
            distribution={reviewDistribution}
            className={styles.ratingSummary}
          />
        </div>
        <ReviewFormClient
          appPublicId={publicId}
          initialValues={{
            id: review.id,
            rating: review.rating.toNumber(),
            body: review.body,
          }}
        />
      </div>
    </div>
  );
}
