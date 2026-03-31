"use client";

import { useRouter } from "next/navigation";
import { MouseEvent, useState } from "react";
import styles from "../page.module.scss";

type TrialClientProps = {
  publicId: string;
  trialSrc: string;
};

export function TrialClient({ publicId, trialSrc }: TrialClientProps) {
  const router = useRouter();
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (isClosing) return;

    setIsClosing(true);

    window.setTimeout(() => {
      router.replace(`/apps/${encodeURIComponent(publicId)}`);
    }, 260);
  };

  return (
    <div
      className={
        isClosing
          ? `${styles.trialFullscreenWrapper} ${styles.trialClosing}`
          : styles.trialFullscreenWrapper
      }
    >
      <button
        type="button"
        className={styles.trialCloseButton}
        onClick={handleClose}
      >
        <span className={styles.trialCloseIcon}>×</span>
      </button>
      <iframe
        src={trialSrc}
        className={styles.trialFullscreenIframe}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
