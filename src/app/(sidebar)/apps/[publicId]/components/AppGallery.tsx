"use client";

import { cn } from "@/lib/cn";
import Image from "next/image";
import styles from "../page.module.scss";
import type { AppDetail } from "./types";

type Props = {
  app: AppDetail;
  currentImageIndex: number;
  onPrev: () => void;
  onNext: () => void;
};

export function AppGallery({ app, currentImageIndex, onPrev, onNext }: Props) {
  const imageCount = app.images.length;
  const hasImages = imageCount > 0;
  const canPrev = imageCount > 1 && currentImageIndex > 0;
  const canNext = imageCount > 1 && currentImageIndex < imageCount - 1;

  if (!hasImages) return null;

  return (
    <div className={styles.galleryRow}>
      <div className={styles.galleryViewport}>
        <div
          className={styles.galleryTrack}
          style={{ transform: `translateX(-${currentImageIndex * 60}%)` }}
        >
          {app.images.map((image) => (
            <div key={image.id} className={styles.gallerySlide}>
              <Image
                src={image.imageUrl}
                alt="アプリ画像"
                width={800}
                height={500}
                unoptimized
              />
            </div>
          ))}
        </div>
      </div>

      {imageCount > 1 && canPrev && (
        <button
          type="button"
          className={cn(styles.galleryNavButton, styles.galleryNavButtonLeft)}
          onClick={onPrev}
          aria-label="前の画像へ"
        >
          <span className={styles.prevIcon} />
        </button>
      )}

      {imageCount > 1 && canNext && (
        <button
          type="button"
          className={cn(styles.galleryNavButton, styles.galleryNavButtonRight)}
          onClick={onNext}
          aria-label="次の画像へ"
        >
          <span className={styles.nextIcon} />
        </button>
      )}
    </div>
  );
}
