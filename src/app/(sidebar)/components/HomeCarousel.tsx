"use client";

import { cn } from "@/lib/cn";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import styles from "../home.module.scss";
import type { HomePageApp } from "./HomePageContent";

const BASE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

type CarouselCategory = "popular" | "subscription" | "template" | "new";

const CAROUSEL_ITEMS = [
  { id: "pop", label: "人気", category: "popular" },
  { id: "sub", label: "サブスク", category: "subscription" },
  { id: "tem", label: "テンプレート", category: "template" },
  { id: "new", label: "新規", category: "new" },
  { id: "pop2", label: "人気", category: "popular" },
  { id: "sub2", label: "サブスク", category: "subscription" },
  { id: "tem2", label: "テンプレート", category: "template" },
  { id: "new2", label: "新規", category: "new" },
] as const satisfies readonly {
  id: string;
  label: string;
  category: CarouselCategory;
}[];

export type HomeCarouselProps = {
  carouselApps: {
    popular: HomePageApp[];
    subscription: HomePageApp[];
    template: HomePageApp[];
    new: HomePageApp[];
  };
};

export default function HomeCarousel({ carouselApps }: HomeCarouselProps) {
  const [currentDeg, setCurrentDeg] = useState(0);

  const handleNext = () => {
    setCurrentDeg((prev) => prev - 45);
  };

  const handlePrev = () => {
    setCurrentDeg((prev) => prev + 45);
  };

  const getAppsForCategory = (category: CarouselCategory): HomePageApp[] => {
    switch (category) {
      case "popular":
        return carouselApps.popular;
      case "subscription":
        return carouselApps.subscription;
      case "template":
        return carouselApps.template;
      case "new":
        return carouselApps.new;
      default:
        return [];
    }
  };

  return (
    <div className={styles.carouselCont}>
      <div
        className={styles.carousel}
        style={{ transform: `rotateY(${currentDeg}deg)` }}
      >
        {CAROUSEL_ITEMS.map((item, index) => {
          let angle = (BASE_ANGLES[index] + currentDeg) % 360;
          if (angle < 0) angle += 360;
          const isFront = angle <= 45 || angle >= 315;
          const categoryApps = getAppsForCategory(item.category);
          const uniqueApps = Array.from(
            new Map(categoryApps.map((app) => [app.publicId, app])).values(),
          );
          const limitedApps = uniqueApps.slice(0, 4);
          const hasApps = limitedApps.length > 0;

          return (
            <div
              key={item.id}
              className={cn(styles.item, styles[item.id])}
              style={{ opacity: isFront ? 1 : 0 }}
            >
              <div className={styles.inner}>
                {[0, 1, 2, 3].map((slot) => {
                  const app = limitedApps[slot];

                  if (!hasApps || !app) {
                    return (
                      <div
                        key={slot}
                        className={cn(styles.innerApp, styles.innerAppDisabled)}
                        aria-disabled="true"
                      />
                    );
                  }
                  const iconSrc = app.iconUrl ?? "/images/icon-default.png";

                  return (
                    <Link
                      key={slot}
                      href={`/apps/${app.publicId}`}
                      className={styles.innerApp}
                    >
                      <Image
                        src={iconSrc}
                        alt={app.name}
                        width={300}
                        height={300}
                      />
                    </Link>
                  );
                })}
              </div>
              <div className={styles.innerText}>{item.label}</div>
            </div>
          );
        })}
      </div>

      <button type="button" className={styles.next} onClick={handleNext}>
        <span className={styles.nextIcon} />
      </button>
      <button type="button" className={styles.prev} onClick={handlePrev}>
        <span className={styles.prevIcon} />
      </button>
    </div>
  );
}
