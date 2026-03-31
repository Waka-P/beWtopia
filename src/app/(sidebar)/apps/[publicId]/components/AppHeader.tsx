"use client";

import { ConfirmModal } from "@/components/ConfirmModal";
import { ErrorModal } from "@/components/ErrorModal";
import { cn } from "@/lib/cn";
import { formatTimeAgo } from "@/utils/date";
import { fetcher } from "@/utils/fetcher";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import styles from "../page.module.scss";
import type { AppDetail } from "./types";

type Props = {
  app: AppDetail;
};

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) return "-";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"] as const;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  const value = parseFloat((bytes / k ** i).toFixed(1));
  return `${value} ${sizes[i]}`;
};

export function AppHeader({ app }: Props) {
  const router = useRouter();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const appTitleRef = useRef<HTMLHeadingElement | null>(null);
  const [appTitleOverflow, setAppTitleOverflow] = useState(0);
  const isBewtsProjectApp = Boolean(app.isBewtsProjectApp);
  const isBewtsLeader = Boolean(app.isBewtsLeader);
  const isOwner = Boolean(app.isOwner);
  const canManageApp = !isBewtsProjectApp ? isOwner : isBewtsLeader;
  const shouldShowManageButtons = isOwner;
  const isManageDisabled = shouldShowManageButtons && !canManageApp;

  // purchase count formatting similar to App Store / Google Play
  const formatPurchaseCount = (count: number) => {
    if (count < 50) return count.toString();

    const digits = Math.floor(Math.log10(count));
    const base = 10 ** digits;
    const rounded = Math.floor(count / base) * base;

    return `${rounded.toLocaleString()}+`;
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await fetcher(`/api/mypage/products/${app.publicId}`, {
        method: "DELETE",
      });
      setIsDeleteModalOpen(false);
      router.push("/mypage/products");
    } catch (error) {
      console.error("アプリの削除に失敗しました", error);
      setErrorMessage("削除に失敗しました");
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    const measure = () => {
      const titleEl = appTitleRef.current;
      if (!titleEl) return;

      const overflow = Math.max(titleEl.scrollWidth - titleEl.clientWidth, 0);
      setAppTitleOverflow(overflow);
    };

    measure();
    window.addEventListener("resize", measure);

    return () => {
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <header className={styles.appHeader}>
      <div className={styles.topWrapper}>
        <div className={styles.appIconWrapper}>
          <Image
            src={app.appIconUrl || "/images/icon-default.png"}
            alt={app.name}
            width={96}
            height={96}
            unoptimized
          />
        </div>
        <div className={styles.appBasicInfo}>
          <h1
            ref={appTitleRef}
            className={cn(
              styles.appTitle,
              appTitleOverflow > 0 && styles.marqueeReady,
            )}
            style={
              {
                "--marquee-distance": `${appTitleOverflow}px`,
              } as CSSProperties
            }
          >
            <span className={styles.marqueeText}>{app.name}</span>
          </h1>
          <div className={styles.appOwnerRow}>
            {app.owner && !app.isOwner ? (
              <Link
                href={`/users/${app.owner.publicId}`}
                className={styles.ownerInfo}
                aria-label={`${app.owner.name} のプロフィールへ`}
              >
                <Image
                  src={app.owner.image || "/images/icon-default.png"}
                  alt={app.owner.name}
                  width={24}
                  height={24}
                  className={styles.ownerIcon}
                  unoptimized
                />
                <span className={styles.ownerName}>{app.owner.name}</span>
              </Link>
            ) : (
              <span>{app.summary}</span>
            )}
          </div>
        </div>
      </div>
      <div className={styles.appMeta}>
        {!app.isOwner && <p className={styles.appSummary}>{app.summary}</p>}
        <div className={styles.appStatsRow}>
          <span className={styles.statItem}>
            ★ {Number(app.rating).toFixed(1)}
          </span>
          <span className={styles.statItem}>
            <Image
              src="/images/download.png"
              alt="ダウンロード数"
              width={16}
              height={16}
              className={styles.downloadIcon}
            />
            {formatPurchaseCount(app._count.purchases)}
          </span>
          <span className={styles.statItem}>
            {app.appFileSizeBytes != null
              ? `${formatFileSize(app.appFileSizeBytes)}`
              : "--"}
          </span>
          <span className={cn(styles.statItem, styles.createdAt)}>
            {formatTimeAgo(app.createdAt)}
          </span>
        </div>
        {shouldShowManageButtons && (
          <div className={styles.buttonsRow}>
            <button
              type="button"
              className={cn(styles.primaryButton, styles.editButton)}
              onClick={() => {
                if (isManageDisabled) return;
                router.push(`/apps/${app.publicId}/edit`);
              }}
              disabled={isManageDisabled}
            >
              編集
            </button>
            <button
              type="button"
              className={cn(styles.secondaryButton, styles.deleteButton)}
              onClick={() => {
                if (isManageDisabled) return;
                setIsDeleteModalOpen(true);
              }}
              disabled={isManageDisabled || isDeleting}
            >
              削除
            </button>
          </div>
        )}
      </div>
      <ConfirmModal
        open={isDeleteModalOpen}
        title="アプリ削除"
        message="このアプリを削除しますか？"
        appName={app.name}
        confirmLabel={isDeleting ? "削除中..." : "削除"}
        cancelLabel="キャンセル"
        onConfirm={handleDelete}
        onCancel={() => {
          if (isDeleting) return;
          setIsDeleteModalOpen(false);
        }}
      />
      <ErrorModal
        open={!!errorMessage}
        title="アプリ削除エラー"
        message={errorMessage ?? ""}
        onClose={() => setErrorMessage(null)}
      />
    </header>
  );
}
