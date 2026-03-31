"use client";
import {
  type ResetPasswordFormData,
  resetPasswordSchema,
} from "@/app/schemas/authSchema";
import { RESET_PASSWORD_STEPS } from "@/app/types/authForm";
import { authClient } from "@/lib/auth-client";
import { normalizeUserInput } from "@/utils/normalize";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import AuthErrNotice from "../components/AuthErrNotice";
import PasswordInput from "../components/PasswordInput";
import { useMultiStepForm } from "../hooks/useMultiStepForm";
import styles from "./page.module.scss";

export default function ResetPassword() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const isInvalidToken = searchParams.get("error") === "INVALID_TOKEN";
  const router = useRouter();
  const methods = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });
  const { handleSubmit, setError } = methods;

  const onSubmit = async ({ password }: ResetPasswordFormData) => {
    if (!token) return;

    try {
      const { error } = await authClient.resetPassword({
        newPassword: normalizeUserInput(password),
        token,
      });

      if (error) {
        if (error.code === "INVALID_TOKEN") {
          setError("root", {
            type: "manual",
            message:
              "無効なトークンです。パスワードリセットのリンクが期限切れの可能性があります",
          });
        } else {
          setError("root", {
            type: "manual",
            message: "パスワードリセットに失敗しました。もう一度お試しください",
          });
        }
        console.error(error);
      } else {
        router.replace("/reset-password/success");
      }
    } catch (err) {
      console.error(err);
    }
  };
  const {
    handleKeyDown,
    inputClassName,
    isCurrentStep,
    inputRefs,
    handleInputClick,
    hasCurrStepErr,
    currStepError,
  } = useMultiStepForm<ResetPasswordFormData>({
    steps: RESET_PASSWORD_STEPS,
    methods,
    onSubmit,
    customInputClasses: {
      currInput: styles.currInput,
      prevPassInput: styles.prevPassInput,
    },
  });

  if (!(token && isInvalidToken)) {
    return (
      <div className={styles.wrapper}>
        <Image
          src="/images/beWtopia.png"
          width={2072}
          height={494}
          alt="beWtopiaのロゴ"
          className={styles.logo}
        />
        <h1 className={styles.title}>パスワードをリセット</h1>
        <p className={styles.message}>
          無効なリンクです
          <br />
          <Link href="/forgot-password" className={styles.link}>
            こちら
          </Link>
          で再度パスワードリセットをリクエストしてください
        </p>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <Image
          src="/images/beWtopia.png"
          width={2072}
          height={494}
          alt="beWtopiaのロゴ"
          className={styles.logo}
        />
        <h1 className={styles.title}>パスワードをリセット</h1>
        <p className={styles.message}>新しいパスワードを入力してください</p>
      </div>
      <FormProvider {...methods}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className={styles.formArea}
          noValidate
        >
          <PasswordInput
            label="新しいパスワードを入力"
            name="password"
            className={inputClassName("password")}
            onKeyDown={handleKeyDown}
            onClick={() => handleInputClick("password")}
            readOnly={!isCurrentStep("password")}
            inputRefs={inputRefs}
          />
          <PasswordInput
            label="パスワードを再入力"
            name="confirmPassword"
            className={inputClassName("confirmPassword")}
            onKeyDown={handleKeyDown}
            onClick={() => handleInputClick("confirmPassword")}
            readOnly={!isCurrentStep("confirmPassword")}
            inputRefs={inputRefs}
          />
        </form>
      </FormProvider>
      <AuthErrNotice
        isOpen={hasCurrStepErr}
        message={currStepError?.message || ""}
      />
    </div>
  );
}
