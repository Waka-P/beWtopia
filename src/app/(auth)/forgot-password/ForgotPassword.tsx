"use client";
import AuthErrNotice from "@/app/(auth)/components/AuthErrNotice";
import {
  type ForgotPasswordFormData,
  forgotPasswordSchema,
} from "@/app/schemas/authSchema";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { normalizeUserInput } from "@/utils/normalize";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import styles from "./page.module.scss";

export default function ForgotPassword() {
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });
  const emailRegister = register("email");
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  const onSubmit = async ({ email }: ForgotPasswordFormData) => {
    try {
      const { error } = await authClient.requestPasswordReset({
        email: normalizeUserInput(email),
        redirectTo: "/reset-password",
      });

      if (error) {
        setError("root", {
          type: "manual",
          message:
            "パスワードリセットのリクエストに失敗しました。もう一度お試しください",
        });
        console.error(error);
        return;
      }

      router.replace("/forgot-password/success");
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
    const handleKeyDown = (e: KeyboardEvent) => {
      clearErrors("root");
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
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
      </form>
      <AuthErrNotice
        isOpen={!!errors.email || !!errors.root}
        message={errors.email?.message || errors.root?.message || ""}
        classNames={{ content: styles.errNoticeContent }}
      />
    </div>
  );
}
