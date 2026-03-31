"use client";

import styles from "@/app/(auth)/components/UserAuthForm/StartScreen.module.scss";
import { signInWithSocial } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import Image from "next/image";
import { useEffect, useState } from "react";
import GoogleButton from "../GoogleButton";

type Props = {
  hoverLocked: boolean;
  onStartClick: () => void;
};

export default function StartScreen({ hoverLocked, onStartClick }: Props) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const EVENT_NAME = "bewtopia:splashHidden";

    const handleSplashHidden = () => {
      setAnimated(true);
    };

    // 既にスプラッシュが閉じられている場合は即座に開始
    if ((window as any).__bewtopiaSplashHidden) {
      setAnimated(true);
    } else {
      window.addEventListener(EVENT_NAME, handleSplashHidden);
    }

    return () => {
      window.removeEventListener(EVENT_NAME, handleSplashHidden);
    };
  }, []);

  const handleGoogleBtnClick = async () => {
    await signInWithSocial("google");
  };

  const handleFacebookBtnClick = async () => {
    await signInWithSocial("facebook");
  };
  return (
    <div
      className={cn(styles.startScreen, hoverLocked && styles.disableHoverAll)}
    >
      <div
        className={cn(
          styles.iconWrapper,
          animated && styles.iconWrapperAnimated,
        )}
      >
        <div className={styles.centerIcon}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onStartClick}
          >
            <Image
              src="/icons/user-icon-default.png"
              width={80}
              height={80}
              alt="メールアドレスでログイン"
            />
          </button>
        </div>

        <div className={styles.googlePos}>
          <GoogleButton onClick={handleGoogleBtnClick} />
        </div>

        <div className={styles.facebookPos}>
          <button
            type="button"
            onClick={handleFacebookBtnClick}
            className={styles.facebookButton}
          >
            <Image
              src="/icons/Facebook_Logo_Primary.png"
              width={80}
              height={80}
              alt="Facebookでログイン"
            />
          </button>
        </div>
      </div>
    </div>
  );
}
