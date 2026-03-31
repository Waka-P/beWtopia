import type { Metadata } from "next";
import Image from "next/image";
import styles from "./page.module.scss";

export const metadata: Metadata = {
  title: "対応していないデバイス",
};

export default function MobileOnlyPage() {
  return (
    <div className={styles.wrapper}>
      <Image
        src="/images/beWtopia.png"
        width={2072}
        height={494}
        alt="beWtopiaのロゴ"
        className={styles.logo}
        priority
      />

      <h1 className={styles.title}>このアプリはPC専用です</h1>
      <span className={styles.message}>
        大変申し訳ありませんが、本アプリはデスクトップ環境でのみご利用いただけます。
      </span>
    </div>
  );
}
