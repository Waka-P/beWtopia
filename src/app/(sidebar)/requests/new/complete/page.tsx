import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "../../../bewts/new/complete/page.module.scss";

export const metadata: Metadata = {
  title: "リクエスト投稿完了",
};

export default async function RequestCreateCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ publicId?: string }>;
}) {
  const { publicId } = await searchParams;

  return (
    <div className={styles.mypageContent}>
      <main className={styles.completeMain}>
        <div className={styles.completeCard}>
          <div className={styles.completeIconWrap}>
            <Image
              src="/images/check-outlined.png"
              alt="投稿完了"
              width={403}
              height={403}
              className={styles.checkIcon}
            />
          </div>
          <h1 className={styles.completeTitle}>リクエストを投稿しました</h1>
          <div className={styles.completeActions}>
            <Link
              href={publicId ? `/requests/${publicId}` : "/requests"}
              className={styles.primaryButton}
            >
              リクエスト詳細へ
            </Link>
            <Link href="/requests" className={styles.secondaryButton}>
              リクエスト一覧へ
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
