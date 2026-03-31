"use client";

import { cn } from "@/lib/cn";
import { useEffect } from "react";

import styles from "./NoticeModal.module.scss";

type NoticeModalProps = {
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  classNames?: Partial<{
    overlay: string;
    content: string;
  }>;
};

export default function NoticeModal({
  isOpen,
  onClose,
  children,
  classNames = {},
}: NoticeModalProps) {
  useEffect(() => {
    if (!isOpen || !onClose) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(styles.overlay, classNames.overlay)}
      onClick={onClose}
      role="dialog"
      aria-hidden
    >
      <div
        className={cn(styles.content, classNames.content)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        {children}
      </div>
    </div>
  );
}
