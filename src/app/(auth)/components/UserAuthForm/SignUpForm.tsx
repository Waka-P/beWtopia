"use client";

import styles from "@/app/(auth)/components/UserAuthForm/SingUpForm.module.scss";
import UserIcon from "@/app/(auth)/components/UserAuthForm/UserIcon";
import { useMultiStepForm } from "@/app/(auth)/hooks/useMultiStepForm";
import { type SignUpFormData, signUpSchema } from "@/app/schemas/authSchema";
import { SIGNUP_STEPS } from "@/app/types/authForm";
import { SubmitProgressOverlay } from "@/components/SubmitProgressOverlay";
import { useSubmitProgressOverlay } from "@/components/useSubmitProgressOverlay";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { normalizeUserInput } from "@/utils/normalize";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { FormProvider, useForm } from "react-hook-form";
import AuthErrNotice from "../AuthErrNotice";
import PasswordInput from "../PasswordInput";

type Props = {
  hoverLocked: boolean;
  noAnimateStartScreen: boolean;
};

export default function SignUpForm({
  hoverLocked,
  noAnimateStartScreen,
}: Props) {
  const router = useRouter();

  const methods = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  });

  const { register, setError } = methods;
  const {
    isVisible: showSubmitOverlay,
    progress: submitProgress,
    iconSrc: submitIconSrc,
    start: startSubmitOverlay,
    finalize: finalizeSubmitOverlay,
    cancel: closeSubmitOverlay,
  } = useSubmitProgressOverlay();

  const onSubmit = useCallback(
    async (formData: SignUpFormData) => {
      try {
        startSubmitOverlay("/images/user-icon-default.png");

        const { error } = await authClient.signUp.email({
          email: normalizeUserInput(formData.email),
          name: normalizeUserInput(formData.name),
          password: normalizeUserInput(formData.password),
          callbackURL: "/", // 確認メールからリダイレクトするURL
        });

        if (error) {
          closeSubmitOverlay();
          if (error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
            setError("root", {
              type: "manual",
              message: "このメールアドレスは既に使用されています",
            });
            return;
          }
        }

        await finalizeSubmitOverlay();
        router.replace("/signup/success");
      } catch (error) {
        closeSubmitOverlay();
        console.error(error);
      }
    },
    [
      closeSubmitOverlay,
      finalizeSubmitOverlay,
      router,
      setError,
      startSubmitOverlay,
    ],
  );

  const {
    inputRefs,
    currStepError,
    hasCurrStepErr,
    isCurrentStep,
    inputClassName,
    handleInputClick,
    handleKeyDown,
  } = useMultiStepForm<SignUpFormData>({
    steps: SIGNUP_STEPS,
    methods,
    onSubmit,
  });

  const emailRegister = register("email");
  const nameRegister = register("name");

  const handleChangeMode = () => {
    router.push("/login");
  };

  return (
    <div className={styles.signUpWrapper}>
      <div
        className={cn(
          noAnimateStartScreen ? styles.slideUpNoAnimate : styles.slideUp,
        )}
      >
        <div className={styles.signUpTitle}>新規登録</div>
        <UserIcon
          isLogin={false}
          onClick={handleChangeMode}
          hoverLocked={hoverLocked}
        />
      </div>

      <FormProvider {...methods}>
        <form
          onSubmit={methods.handleSubmit(onSubmit)}
          className={styles.formArea}
        >
          <input
            type="email"
            placeholder="メールアドレスを入力"
            autoComplete="off"
            {...emailRegister}
            ref={(el) => {
              emailRegister.ref(el);
              inputRefs.current.email = el;
            }}
            onKeyDown={handleKeyDown}
            onClick={() => handleInputClick("email")}
            readOnly={!isCurrentStep("email")}
            className={inputClassName("email")}
          />
          <input
            type="text"
            autoComplete="off"
            placeholder="名前を入力"
            {...nameRegister}
            ref={(el) => {
              nameRegister.ref(el);
              inputRefs.current.name = el;
            }}
            onKeyDown={handleKeyDown}
            onClick={() => handleInputClick("name")}
            readOnly={!isCurrentStep("name")}
            className={inputClassName("name")}
          />
          <PasswordInput
            label="パスワードを入力"
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
      <SubmitProgressOverlay
        visible={showSubmitOverlay}
        progress={submitProgress}
        iconSrc={submitIconSrc}
        alt="新規登録中アイコン"
        iconSize={80}
      />
    </div>
  );
}
