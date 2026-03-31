"use client";

import { fetcher } from "@/utils/fetcher";
import { getLocalStorage, removeLocalStorage } from "@/utils/localStorage";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useDownload } from "../../contexts/DownloadContext";
import styles from "./page.module.scss";

type PurchaseCompleteClientProps = {
  isSubscriptionOnly: boolean;
};

export default function PurchaseCompleteClient({
  isSubscriptionOnly,
}: PurchaseCompleteClientProps) {
  const { addItems } = useDownload();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const run = async () => {
      try {
        const parsed = getLocalStorage<unknown[]>("bew_purchased_apps", []);
        if (!Array.isArray(parsed)) return;
        const ids = parsed.filter((v): v is string => typeof v === "string");

        const apps = await Promise.all(
          ids.map((id) =>
            fetcher<{ name: string; downloadUrl?: string }>(
              `/api/apps/${encodeURIComponent(id)}`,
            ).catch(() => null),
          ),
        );

        const downloadItems = ids
          .map((id, idx) => ({
            id,
            name: apps[idx]?.name ?? id,
            fileUrl: apps[idx]?.downloadUrl ?? null,
          }))
          .filter(
            (a): a is { id: string; name: string; fileUrl: string } =>
              a.fileUrl !== null,
          )
          .map((a): { id: string; name: string; fileUrl: string } => ({
            id: a.id,
            name: a.name,
            fileUrl: a.fileUrl,
          }))
          .map((a) => ({
            id: a.id,
            name: a.name,
            fileUrl: a.fileUrl,
            status: "idle" as const,
          }));

        if (downloadItems.length > 0) {
          addItems(downloadItems);
        }
      } catch {
        // ignore
      } finally {
        try {
          removeLocalStorage("bew_purchased_apps");
        } catch {
          // ignore
        }
      }
    };

    void run();
  }, [addItems]);

  return (
    <div className={styles.mypageContent}>
      <main className={styles.completeMain}>
        <div className={styles.completeCard}>
          <div className={styles.completeIconWrap}>
            <Image
              src="/images/check-outlined.png"
              alt="購入完了"
              width={403}
              height={403}
              className={styles.checkIcon}
            />
          </div>

          <h1 className={styles.completeTitle}>
            {isSubscriptionOnly
              ? "サブスクリプションの登録が完了しました"
              : "購入が完了しました"}
          </h1>

          <p style={{ marginBottom: 16 }}>
            右上のダウンロードリストからファイルを取得できます。
          </p>

          <div className={styles.completeActions}>
            <Link href="/mypage/purchases" className={styles.primaryButton}>
              購入一覧へ
            </Link>
            <Link href="/" className={styles.secondaryButton}>
              ホームへ
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
