"use client";

import { cn } from "@/lib/cn";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import styles from "./Modal.module.scss";

interface ModalProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onAnimationEnd?: () => void;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
  showCloseButton?: boolean;
  overlayClassName?: string;
  contentClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  useRouterBack?: boolean;
}

export function Modal({
  open,
  onOpenChange,
  onAnimationEnd,
  title,
  description,
  children,
  footer,
  maxWidth = "md",
  showCloseButton = true,
  overlayClassName,
  contentClassName,
  headerClassName,
  bodyClassName,
  footerClassName,
  // when true, closing the modal will call `router.back()` instead of
  // calling `onOpenChange(false)` (useful for intercepting-route modals)
  useRouterBack = false,
}: ModalProps) {
  const [isClosing, setIsClosing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!open) {
      setIsClosing(true);
    } else {
      setIsClosing(false);
    }
  }, [open]);

  const handleAnimationEnd = (e: React.AnimationEvent) => {
    // オーバーレイまたはコンテンツのアニメーション終了時
    if (isClosing && onAnimationEnd && e.target === e.currentTarget) {
      onAnimationEnd();
    }
  };

  // Wrap onOpenChange to optionally use router.back() when closing
  const handleOpenChange = (next: boolean) => {
    if (!next && useRouterBack) {
      // prefer router.back() to preserve intercepting-route navigation
      try {
        router.back();
      } catch {
        onOpenChange?.(false);
      }
      return;
    }

    onOpenChange?.(next);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(styles.modalOverlay, overlayClassName)}
          onAnimationEnd={handleAnimationEnd}
        />
        <Dialog.Content
          className={cn(
            styles.modalContent,
            styles[maxWidth],
            contentClassName,
          )}
          onAnimationEnd={handleAnimationEnd}
        >
          <Dialog.Title className={styles.srOnly}>{title}</Dialog.Title>
          <Dialog.Description className={styles.srOnly}>
            {description}
          </Dialog.Description>
          {showCloseButton && (
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => {
                if (useRouterBack) {
                  router.back();
                } else {
                  onOpenChange?.(false);
                }
              }}
            >
              &times;
            </button>
          )}
          {title && (
            <div className={cn(styles.modalHeader, headerClassName)}>
              <Dialog.Title className={styles.modalTitle}>{title}</Dialog.Title>
            </div>
          )}
          <div className={cn(styles.modalBody, bodyClassName)}>{children}</div>
          {footer && (
            <div className={cn(styles.modalFooter, footerClassName)}>
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
