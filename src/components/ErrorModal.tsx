"use client";

import Image from "next/image";
import styles from "./ErrorModal.module.scss";

type ErrorModalProps = {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
};

export function ErrorModal({ open, title, message, onClose }: ErrorModalProps) {
  if (!open) return null;

  return (
    <button
      type="button"
      className={styles.errorOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={styles.errorModalWrapper}>
        <Image
          src="/images/exclamation-danger.png"
          width={114}
          height={119}
          alt="エラー"
          className={styles.errorIcon}
        />
        <h1 className={styles.errorTitle}>{title}</h1>
        <p className={styles.errorMessage}>{message}</p>
      </div>
    </button>
  );
}
