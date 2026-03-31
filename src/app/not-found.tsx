import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "./not-found.module.scss";

export const metadata: Metadata = {
  title: "ページが見つかりません",
};

export default function NotFoundPage() {
  return (
    <div className={styles.wrapper}>
      <Image
        src="/images/beWtopia.png"
        width={2072}
        height={494}
        alt="beWtopiaのロゴ"
        className={styles.logo}
      />
      <Image
        src="/images/exclamation-primary.png"
        width={114}
        height={114}
        alt="ページが見つかりません"
        className={styles.icon}
      />
      <h1 className={styles.title}>ページが見つかりません</h1>
      <p className={styles.message}>
        お探しのページは存在しないか、移動した可能性があります
      </p>
      <Link href="/" className={styles.homeLink}>
        ホームへ
      </Link>
    </div>
  );
}
