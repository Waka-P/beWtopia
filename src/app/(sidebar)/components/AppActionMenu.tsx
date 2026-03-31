"use client";

import { cn } from "@/lib/cn";
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";
import Image from "next/image";
import type { MouseEvent } from "react";
import styles from "../home.module.scss";

export type AppActionMenuProps = {
  appPublicId: string;
  isOpen: boolean;
  isFavorite: boolean;
  onToggle: () => void;
  onToggleFavorite: () => void;
  onHide: () => void;
};

export default function AppActionMenu({
  appPublicId,
  isOpen,
  isFavorite,
  onToggle,
  onToggleFavorite,
  onHide,
}: AppActionMenuProps) {
  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    placement: "bottom-end",
    whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  });

  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        className={styles.actionMenuBtn}
        data-home-action-menu-btn
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls={`app-menu-${appPublicId}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </button>

      <FloatingPortal>
        <div
          ref={refs.setFloating}
          id={`app-menu-${appPublicId}`}
          className={cn(styles.actionMenu, isOpen && styles.show)}
          data-home-action-menu
          style={{
            ...floatingStyles,
            // isOpenがfalseのときはポインターイベントを無効化
            pointerEvents: isOpen ? "auto" : "none",
          }}
          onClick={(e: MouseEvent) => e.stopPropagation()}
        >
          <ul>
            <li>
              <button
                type="button"
                className={cn(
                  styles.actionMenuItem,
                  styles.favoriteBtn,
                  isFavorite && styles.active,
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite();
                }}
              >
                <span className={styles.favoriteLabel}>
                  {isFavorite ? "お気に入り中" : "お気に入り"}
                </span>
                <Image
                  className={styles.favoriteImg}
                  src={
                    isFavorite
                      ? "/images/favorite-filled.png"
                      : "/images/favorite.png"
                  }
                  alt={isFavorite ? "お気に入り中" : "お気に入り"}
                  width={16}
                  height={16}
                />
              </button>
            </li>
            <li>
              <button
                type="button"
                className={styles.actionMenuItem}
                onClick={(e) => {
                  e.stopPropagation();
                  onHide();
                }}
              >
                <span>非表示</span>
                <Image
                  className={styles.icon}
                  src="/images/hidden.png"
                  alt="非表示"
                  width={15}
                  height={15}
                />
              </button>
            </li>
          </ul>
        </div>
      </FloatingPortal>
    </>
  );
}
