import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.scss";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const from = params.from;
  const isFromBewts = from === "bewts";

  return {
    title: isFromBewts ? "ビューズ完了" : "ビュート完了",
  };
}

export default async function BewtCompletePage(props: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const from = searchParams.from;
  const isFromBewts = from === "bewts";
  const appId = searchParams.bewtedId;

  return (
    <div className={styles.mypageContent}>
      <main className={styles.completeMain}>
        <div className={styles.completeCard}>
          <div className={styles.completeIconWrap}>
            <Image
              src="/images/check-outlined.png"
              alt={isFromBewts ? "ビューズ完了" : "ビュート完了"}
              width={403}
              height={403}
              className={styles.checkIcon}
            />
          </div>
          <h1 className={styles.completeTitle}>
            {isFromBewts ? "ビューズが完了しました" : "ビュートが完了しました"}
          </h1>
          <div className={styles.completeActions}>
            <Link href="/mypage/products" className={styles.primaryButton}>
              出品一覧へ
            </Link>
            <Link
              href={appId ? `/apps/${appId}` : `/`}
              className={styles.secondaryButton}
            >
              {appId ? "アプリ詳細へ" : "ホームへ"}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
