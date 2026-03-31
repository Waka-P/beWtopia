"use client";

import { cn } from "@/lib/cn";
import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import styles from "./BewtsDetail.module.scss";

type DetailNavButtonProps = {
  publicId: string;
  showBewt: boolean;
  showSettings: boolean;
};

type MenuButton = {
  href: string;
  label: string;
  imageSrc: string;
  imageAlt: string;
  imageWidth: number;
  imageFilter?: string;
};

const CHAT_BUTTON_CONFIG = {
  label: "チャット",
  imageSrc: "/icons/sidebar/chat-filled.png",
  imageAlt: "チャット",
  imageWidth: 34,
  imageFilter: "brightness(0) invert(1)",
};

export default function BewtsDetailNavButton({
  publicId,
  showBewt,
  showSettings,
}: DetailNavButtonProps) {
  const subButtons = useMemo(() => {
    const buttons: MenuButton[] = [];

    if (showBewt) {
      buttons.push({
        href: `/bewts/${publicId}/bewt`,
        label: "ビューズ",
        imageSrc: "/icons/sidebar/bewts-filled.png",
        imageAlt: "ビューズ",
        imageWidth: 42,
      });
    }

    if (showSettings) {
      buttons.push({
        href: `/bewts/${publicId}/settings`,
        label: "設定",
        imageSrc: "/images/mypage-nav/settings.png",
        imageAlt: "設定",
        imageWidth: 34,
        imageFilter: "brightness(0) invert(1)",
      });
    }

    return buttons;
  }, [publicId, showBewt, showSettings]);

  return (
    <div className={styles.detailNavTrayWrapper}>
      <Link
        href={`/bewts/${publicId}/chat`}
        className={cn(styles.detailNavButton, styles.detailNavButtonAnchor)}
        aria-label="チャット"
      >
        <Image
          src={CHAT_BUTTON_CONFIG.imageSrc}
          width={550}
          height={551}
          alt={CHAT_BUTTON_CONFIG.imageAlt}
          style={{
            width: CHAT_BUTTON_CONFIG.imageWidth,
            height: "auto",
            filter: CHAT_BUTTON_CONFIG.imageFilter,
          }}
        />
        <div className={styles.detailNavButtonOverlay}>チャット</div>
      </Link>

      <div className={styles.detailNavOverlay} />

      {subButtons.length > 0 && (
        <div className={styles.detailNavLinkButtons}>
          {subButtons.map((button) => (
            <Link
              key={button.href}
              href={button.href}
              className={styles.detailNavLinkButton}
              aria-label={button.label}
            >
              <Image
                src={button.imageSrc}
                width={550}
                height={551}
                alt={button.imageAlt}
                style={{
                  width: button.imageWidth,
                  height: "auto",
                  filter: button.imageFilter,
                }}
              />
              <div className={styles.detailNavLinkOverlay}>{button.label}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
