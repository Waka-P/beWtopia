"use client";
import AuthErrNotice from "@/app/(auth)/components/AuthErrNotice";
import {
  forgotPasswordSchema,
  type ResendVerificationFormData,
} from "@/app/schemas/authSchema";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { normalizeUserInput } from "@/utils/normalize";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import styles from "./page.module.scss";

export default function ResendVerification() {
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<ResendVerificationFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });
  const COOLDOWN_SECONDS = 60;
  const [countdown, setCountdown] = useState(0);
  const emailRegister = register("email");
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  const onSubmit = async ({ email }: ResendVerificationFormData) => {
    if (countdown > 0 || isSubmitting) return;

    try {
      const { error } = await authClient.sendVerificationEmail({
        email: normalizeUserInput(email),
        callbackURL: "/",
      });

      if (error) {
        setError("root", {
          type: "manual",
          message: "確認メールの再送信に失敗しました。もう一度お試しください",
        });
        console.error(error);
        return;
      }

      setCountdown(COOLDOWN_SECONDS);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit(onSubmit)();
    }
  };

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      clearErrors("root");
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [clearErrors]);

  return (
    <div className={styles.wrapper}>
      <Image
        src="/images/beWtopia.png"
        width={2072}
        height={494}
        alt="beWtopiaのロゴ"
        className={styles.logo}
      />
      <h1 className={styles.title}>確認メールを再送信</h1>
      <p className={styles.message}>
        登録しているメールアドレスを入力してください
      </p>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className={styles.formArea}
        noValidate
      >
        <input
          type="email"
          placeholder="メールアドレスを入力"
          disabled={isSubmitting || countdown > 0}
          autoComplete="off"
          {...emailRegister}
          ref={(el) => {
            emailRegister.ref(el);
            emailInputRef.current = el;
            emailInputRef.current?.focus();
          }}
          className={cn(
            styles.emailInput,
            (errors.email || errors.root) && styles.isInvalid,
          )}
          onKeyDown={handleEmailKeyDown}
        />
        {countdown > 0 && (
          <p className={styles.countdown}>再送信まで {countdown}秒</p>
        )}
      </form>
      <AuthErrNotice
        isOpen={!!errors.email || !!errors.root}
        message={errors.email?.message || errors.root?.message || ""}
        classNames={{ content: styles.errNoticeContent }}
      />
    </div>
  );
}
