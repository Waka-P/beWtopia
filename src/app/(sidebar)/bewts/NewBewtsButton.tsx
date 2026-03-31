"use client";

import { cn } from "@/lib/cn";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import styles from "./Projects.module.scss";

type BewtsButtonType = "open" | "new" | "joined";

type NewBewtsButtonProps = {
  current: BewtsButtonType;
};

const BUTTON_CONFIG: Record<
  BewtsButtonType,
  {
    href: string;
    label: string;
    imageSrc: string;
    imageAlt: string;
    imageWidth: number;
    imageHeight: number;
    iconSizeClassName: string;
  }
> = {
  open: {
    href: "/bewts",
    label: "募集中",
    imageSrc: "/images/bewts-join.png",
    imageAlt: "募集中",
    imageWidth: 500,
    imageHeight: 500,
    iconSizeClassName: styles.openIconSize,
  },
  new: {
    href: "/bewts/new",
    label: "募集する",
    imageSrc: "/images/plus-mark.png",
    imageAlt: "募集する",
    imageWidth: 500,
    imageHeight: 500,
    iconSizeClassName: styles.newIconSize,
  },
  joined: {
    href: "/bewts/joined",
    label: "参加中",
    imageSrc: "/images/bewts-joined.png",
    imageAlt: "参加中",
    imageWidth: 550,
    imageHeight: 551,
    iconSizeClassName: styles.joinedIconSize,
  },
};

export default function NewBewtsButton({ current }: NewBewtsButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const currentButton = BUTTON_CONFIG[current];
  const linkButtons = (Object.keys(BUTTON_CONFIG) as BewtsButtonType[])
    .filter((key) => key !== current)
    .map((key) => BUTTON_CONFIG[key]);

  return (
    <div
      className={styles.newButtonTrayWrapper}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <div
        className={cn(
          styles.newButton,
          styles.newButtonAnchor,
          currentButton.iconSizeClassName,
        )}
      >
        <Image
          src={currentButton.imageSrc}
          width={currentButton.imageWidth}
          height={currentButton.imageHeight}
          alt={currentButton.imageAlt}
        />
        <div className={cn(styles.newButtonOverlay, isOpen && styles.show)}>
          {currentButton.label}
        </div>
      </div>

      <div className={cn(styles.fullOverlay, isOpen && styles.show)} />

      <div className={cn(styles.linkButtonIcons, isOpen && styles.show)}>
        {linkButtons.map((button) => (
          <Link
            key={button.href}
            href={button.href}
            className={cn(styles.linkButton, button.iconSizeClassName)}
            aria-label={button.label}
          >
            <Image
              src={button.imageSrc}
              width={button.imageWidth}
              height={button.imageHeight}
              alt={button.imageAlt}
            />
            <div className={styles.linkButtonOverlay}>{button.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
