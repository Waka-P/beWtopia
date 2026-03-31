"use client";

import {
  APP_DETAIL_LOADING_MARKER_KEY,
  APP_DETAIL_LOADING_MIN_MS,
} from "@/app/(sidebar)/components/appDetailLoadingConfig";
import { cn } from "@/lib/cn";
import Image from "next/image";
import { useEffect, useState } from "react";
import AppDetailClient from "./AppDetail";
import type { AppDetail } from "./page";
import styles from "./page.module.scss";

type AppDetailPageClientProps = {
  app: AppDetail;
};

export default function AppDetailPageClient({ app }: AppDetailPageClientProps) {
  const [showLoading, setShowLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const shouldShowLoading =
      window.sessionStorage.getItem(APP_DETAIL_LOADING_MARKER_KEY) === "1";

    if (!shouldShowLoading) {
      setShowLoading(false);
      return;
    }

    setShowLoading(true);
    requestAnimationFrame(() => {
      setIsVisible(true);
    });

    const timer = window.setTimeout(() => {
      setIsClosing(true);
      window.sessionStorage.removeItem(APP_DETAIL_LOADING_MARKER_KEY);

      setTimeout(() => {
        setShowLoading(false);
        setIsClosing(false);
      }, 300);
    }, APP_DETAIL_LOADING_MIN_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  if (showLoading) {
    return (
      <div
        className={cn(
          styles.loadingOverlay,
          isVisible && styles.visible,
          isClosing && styles.closing,
        )}
        aria-live="polite"
      >
        <div className={styles.loadingIconWrapper}>
          <Image
            src={app.appIconUrl || "/images/icon-default.png"}
            alt={`${app.name}のアイコン`}
            fill
            className={styles.loadingIcon}
            sizes="112px"
            priority
          />
        </div>
      </div>
    );
  }

  return <AppDetailClient app={app} />;
}
