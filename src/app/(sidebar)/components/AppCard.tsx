"use client";

import { cn } from "@/lib/cn";
import Image from "next/image";
import Link from "next/link";
import styles from "../home.module.scss";
import AppActionMenu from "./AppActionMenu";
import type { HomePageApp } from "./HomePageContent";
import Rating from "./Rating";

export type AppCardProps = {
  app: HomePageApp;
  isMenuOpen: boolean;
  isFavorite: boolean;
  onToggleMenu: () => void;
  onToggleFavorite: () => void;
  onHide: () => void;
};

export default function AppCard({
  app,
  isMenuOpen,
  isFavorite,
  onToggleMenu,
  onToggleFavorite,
  onHide,
}: AppCardProps) {
  const iconSrc = app.iconUrl ?? "/images/icon-default.png";
  const hasThumbnail = Boolean(app.thumbnailUrl);

  return (
    <div className={styles.app}>
      <Link href={`/apps/${app.publicId}`}>
        <div className={styles.appHeader}>
          <span className={styles.appIcon}>
            <Image
              src={iconSrc}
              alt={app.name}
              width={240}
              height={240}
              unoptimized
            />
          </span>

          <div className={styles.appInfo}>
            <h2 className={styles.appName}>{app.name}</h2>
            <p className={styles.appDesc}>{app.summary}</p>
            <Rating value={app.rating} />
          </div>
        </div>

        {hasThumbnail ? (
          <div className={styles.thumbnail}>
            {app.thumbnailUrl && (
              <Image
                src={app.thumbnailUrl}
                alt={`${app.name} のサムネイル`}
                width={640}
                height={400}
                unoptimized
              />
            )}
          </div>
        ) : (
          <div className={cn(styles.thumbnail, styles.noImage)}>
            <span>NO IMAGE</span>
          </div>
        )}
      </Link>

      <AppActionMenu
        appPublicId={app.publicId}
        isOpen={isMenuOpen}
        isFavorite={isFavorite}
        onToggle={onToggleMenu}
        onToggleFavorite={onToggleFavorite}
        onHide={onHide}
      />
    </div>
  );
}
