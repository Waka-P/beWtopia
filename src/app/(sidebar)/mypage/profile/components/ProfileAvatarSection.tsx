"use client";

import Rating from "@/app/(sidebar)/components/Rating";
import Avatar from "@/components/Avatar";
import { authClient } from "@/lib/auth-client";
import Image from "next/image";
import {
  type ChangeEventHandler,
  type CSSProperties,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import styles from "../page.module.scss";

type ProfileAvatarSectionProps = {
  editing: boolean;
  profileImage: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onAvatarClick: () => void;
  onAvatarChange: ChangeEventHandler<HTMLInputElement>;
  name: string;
  onNameChange: (value: string) => void;
  rating: number;
};

export function ProfileAvatarSection({
  editing,
  profileImage,
  fileInputRef,
  onAvatarClick,
  onAvatarChange,
  name,
  onNameChange,
  rating,
}: ProfileAvatarSectionProps) {
  const { data: session } = authClient.useSession();
  const nameRef = useRef<HTMLDivElement | null>(null);
  const [nameOverflow, setNameOverflow] = useState(0);

  useEffect(() => {
    const measure = () => {
      const nameEl = nameRef.current;
      if (!nameEl) return;
      const overflow = Math.max(nameEl.scrollWidth - nameEl.clientWidth, 0);
      setNameOverflow(overflow);
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div className={styles.header}>
      <button
        type="button"
        className={styles.avatarButton}
        style={{ cursor: editing ? "pointer" : "default" }}
        onClick={onAvatarClick}
      >
        <Avatar
          src={profileImage ?? session?.user?.image ?? null}
          alt="あなたのアイコン"
          className={styles.avatar}
        />
        {editing && (
          <div className={styles.avatarOverlay}>
            <Image
              src="/images/pic.png"
              alt="アイコン編集"
              className={styles.avatarOverlayImage}
              width={32}
              height={32}
            />
          </div>
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onAvatarChange}
      />

      <div className={styles.headerMain}>
        <div
          className={
            editing
              ? `${styles.labelInline} ${styles.labelInlineColumn}`
              : styles.labelInline
          }
        >
          {editing ? (
            <>
              <label htmlFor="profile-name">表示名</label>
              <input
                id="profile-name"
                className={styles.input}
                type="text"
                placeholder="例）クリエイター太郎"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
              />
            </>
          ) : (
            <>
              <div
                ref={nameRef}
                className={`${styles.viewName} ${nameOverflow > 0 ? styles.marqueeReady : ""}`}
                style={
                  {
                    "--marquee-distance": `${nameOverflow}px`,
                  } as CSSProperties
                }
              >
                <span className={styles.marqueeText}>{name || "未設定"}</span>
              </div>
              <div className={styles.userRating}>
                <Rating value={rating} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
