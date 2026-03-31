"use client";

import { Modal } from "@/components/Modal";
import { cn } from "@/lib/cn";
import Image from "next/image";
import type { ReactNode } from "react";
import styles from "./FilterModal.module.scss";

export type FilterModalProps = {
  open: boolean;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  onOpenChange: (open: boolean) => void;
  onReset?: () => void;
  onApply?: () => void;
  applyLabel?: string;
  resetLabel?: string;
};

export function FilterModal({
  open,
  title = "フィルター",
  description = "一覧の表示条件を変更できます",
  children,
  className,
  onOpenChange,
  onReset,
  onApply,
  applyLabel = "適用",
  resetLabel = "リセット",
}: FilterModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      maxWidth="md"
      showCloseButton
      bodyClassName={cn(styles.body, className)}
      footerClassName={styles.footer}
      footer={
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.resetButton}
            onClick={onReset}
          >
            <Image
              src="/images/reset.png"
              alt={resetLabel}
              width={96}
              height={96}
              className={styles.resetIcon}
            />
          </button>
          <button
            type="button"
            className={styles.applyButton}
            onClick={onApply}
          >
            {applyLabel}
          </button>
        </div>
      }
    >
      {children}
    </Modal>
  );
}
