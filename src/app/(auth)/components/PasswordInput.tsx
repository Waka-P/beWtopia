"use client";
import AuthNotice from "@/app/(auth)/components/AuthNotice";
import styles from "@/app/(auth)/components/PasswordInput.module.scss";
import type { Step } from "@/app/types/authForm";
import { cn } from "@/lib/cn";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";

type Props = {
  label: string;
  name: Step;
  className: string;
  onKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
  inputRefs: React.RefObject<Record<Step, HTMLInputElement | null>>;
  onClick?: () => void;
  readOnly?: boolean;
  hasForgotPassNotice?: boolean;
};

const MAX_DOTS = 6;

export default function PasswordInput({
  label,
  name,
  className,
  onKeyDown,
  inputRefs,
  onClick,
  readOnly,
  hasForgotPassNotice = false,
}: Props) {
  const [showCursorAsFilled, setShowCursorAsFilled] = useState(false);
  const [isForgotPassOpen, setIsForgotPassOpen] = useState(false);
  const { register, control } = useFormContext();
  const passwordRegister = register(name);
  const password = useWatch({
    control,
    name,
  });

  useEffect(() => {
    if (password?.length > 0) {
      setShowCursorAsFilled(true);
      const timer = setTimeout(() => setShowCursorAsFilled(false), 200);
      return () => clearTimeout(timer);
    }
  }, [password]);

  const length = password?.length ?? 0;
  const isOverflow = length > MAX_DOTS;

  const openForgotPassNotice = () => {
    setIsForgotPassOpen(true);
  };

  return (
    <>
      <div className={cn(styles.wrapper, className)}>
        <input
          type="password"
          className={styles.input}
          autoComplete="off"
          {...passwordRegister}
          onKeyDown={onKeyDown}
          onClick={onClick}
          readOnly={readOnly}
          ref={(el) => {
            passwordRegister.ref(el);
            inputRefs.current[name] = el;
          }}
        />

        <p className={styles.label}>{label}</p>

        <div className={styles.passwordArea}>
          {Array.from({ length: MAX_DOTS }).map((_, index) => {
            if (isOverflow && index === MAX_DOTS - 1) {
              return (
                <span
                  // biome-ignore lint: 入れ替えは発生しないのでindexをkeyに設定
                  key={index}
                  className={cn(
                    styles.cursorDot,
                    showCursorAsFilled && styles.filled,
                  )}
                />
              );
            }

            const filledCount = isOverflow ? MAX_DOTS - 1 : length;
            const isFilled = index < filledCount;

            return (
              <span
                // biome-ignore lint: 入れ替えは発生しないのでindexをkeyに設定
                key={index}
                className={cn(
                  styles.dot,
                  isFilled ? styles.filled : styles.bordered,
                )}
              />
            );
          })}
        </div>
        {hasForgotPassNotice && (
          <button
            type="button"
            onClick={openForgotPassNotice}
            className={cn(
              styles.forgotPassButton,
              isForgotPassOpen && styles.hidden,
            )}
          >
            <Image
              src="/images/exclamation-primary.png"
              width={114}
              height={114}
              alt="お知らせ"
            />
          </button>
        )}
      </div>
      {hasForgotPassNotice && (
        <AuthNotice
          isOpen={isForgotPassOpen}
          onClose={() => setIsForgotPassOpen(false)}
          classNames={{ content: styles.noticeContent }}
        >
          <Image
            src="/images/exclamation-primary.png"
            width={114}
            height={114}
            alt="お知らせ"
            className={styles.noticeIcon}
          />
          <p className={styles.noticeTitle}>パスワードを忘れましたか？</p>
          <Link href="/forgot-password" className={styles.noticeText}>
            パスワードをリセット
          </Link>
        </AuthNotice>
      )}
    </>
  );
}
