"use client";

import GoogleButton from "@/app/(auth)/components/GoogleButton";
import { signInWithSocial } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import Image from "next/image";
import { useAuthUI } from "../../contexts/AuthUIContext";
import styles from "./UserIcon.module.scss";

type Props = {
  isLogin: boolean;
  onClick: () => void;
  hoverLocked: boolean;
};

export default function UserIcon({ isLogin, onClick, hoverLocked }: Props) {
  const { isIconTrayOpen: isOpen, setIsIconTrayOpen: setIsOpen } = useAuthUI();
  const handleGoogleBtnClick = async () => {
    await signInWithSocial("google");
  };

  const handleFacebookBtnClick = async () => {
    await signInWithSocial("facebook");
  };
  return (
    <div
      className={styles.wrapper}
      role="none"
      onMouseEnter={() => !hoverLocked && setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button type="button" className={styles.iconWrapper} onClick={onClick}>
        <Image
          src="/icons/user-icon-default.png"
          width={80}
          height={80}
          alt="user"
          className={styles.icon}
        />

        <div className={cn(styles.overlay, isOpen && styles.show)}>
          {isLogin ? "新規登録" : "ログイン"}
        </div>
      </button>

      <div className={cn(styles.fullOverlay, isOpen && styles.show)} />

      <div className={cn(styles.socialIcons, isOpen && styles.show)}>
        {/* Google */}
        <GoogleButton onClick={handleGoogleBtnClick} />

        {/* Facebook */}
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
  );
}
