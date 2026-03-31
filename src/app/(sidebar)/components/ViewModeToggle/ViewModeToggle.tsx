"use client";

import { cn } from "@/lib/cn";
import Image from "next/image";
import styles from "./ViewModeToggle.module.scss";

export type ViewMode = "list" | "card" | "grid";
type IconVariant = "app" | "user";

type Props = {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  iconVariant?: IconVariant;
  className?: string;
};

const appIcons: Record<ViewMode, string> = {
  list: "/images/app-layout/list.png",
  card: "/images/app-layout/card.png",
  grid: "/images/app-layout/grid.png",
};

const userIcons: Record<ViewMode, string> = {
  list: "/images/user-layout/list.png",
  card: "/images/user-layout/card.png",
  grid: "/images/user-layout/grid.png",
};

const labels: Record<ViewMode, string> = {
  list: "リスト",
  card: "カード",
  grid: "グリッド",
};

export function ViewModeToggle({
  mode,
  onChange,
  iconVariant = "app",
  className,
}: Props) {
  const icons = iconVariant === "user" ? userIcons : appIcons;

  return (
    <div className={cn(styles.root, className)}>
      {(["list", "card", "grid"] as const).map((view) => (
        <button
          key={view}
          type="button"
          className={cn(styles.button, mode === view && styles.active)}
          onClick={() => onChange(view)}
          aria-pressed={mode === view}
          aria-label={`${labels[view]}表示`}
        >
          <Image
            src={icons[view]}
            width={30}
            height={30}
            alt={labels[view]}
            className={styles.icon}
          />
        </button>
      ))}
    </div>
  );
}
