"use client";

import { cn } from "@/lib/cn";
import { useEffect, useState } from "react";
import styles from "../components/BewtsChatArea.module.scss";

export default function BewtsChatRoomLoading() {
  // ページ遷移が速く完了する場合はローディングを見せないよう、
  // 一定時間経過してからスケルトンをフェードイン表示する
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowSkeleton(true);
    }, 200);
    return () => window.clearTimeout(timer);
  }, []);

  const skeletonWidths = [240, 200, 220, 180, 160];

  return (
    <div className={styles.chatArea}>
      <div className={styles.header}>
        <div className={styles.headerTitle} style={{ cursor: "default" }}>
          <span
            className={styles.headerTitleSkeleton}
            aria-hidden={!showSkeleton}
          />
        </div>
      </div>
      <div className={styles.messagesCont}>
        <div
          className={cn(
            styles.messages,
            styles.messagesSkeleton,
            showSkeleton
              ? styles.messagesSkeletonVisible
              : styles.messagesSkeletonHidden,
          )}
          aria-hidden={!showSkeleton}
        >
          {skeletonWidths.map((width, index) => (
            <div
              key={width}
              className={cn(
                styles.messageSkeletonRow,
                index % 2 === 0
                  ? styles.messageSkeletonRowLeft
                  : styles.messageSkeletonRowRight,
              )}
            >
              <div className={styles.messageSkeletonBubble}>
                <div
                  className={styles.messageSkeletonContent}
                  style={{ width }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
