"use client";

import styles from "@/app/(auth)/components/UserAuthForm/LoginForm.module.scss";
import UserIcon from "@/app/(auth)/components/UserAuthForm/UserIcon";
import { useMultiStepForm } from "@/app/(auth)/hooks/useMultiStepForm";
import { type LoginFormData, loginSchema } from "@/app/schemas/authSchema";
import { LOGIN_STEPS } from "@/app/types/authForm";
import { SubmitProgressOverlay } from "@/components/SubmitProgressOverlay";
import { useSubmitProgressOverlay } from "@/components/useSubmitProgressOverlay";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import AuthErrNotice from "../AuthErrNotice";
import PasswordInput from "../PasswordInput";
import ResendVerificationBtn from "./ResendVerificationBtn";
import ResendVerificationNotice from "./ResendVerificationNotice";

type Props = {
  hoverLocked: boolean;
  noAnimateStartScreen: boolean;
};

export default function LoginForm({
  hoverLocked,
  noAnimateStartScreen,
}: Props) {
  const router = useRouter();
  const methods = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });
  const { handleSubmit, register, setError } = methods;
  const emailRegister = register("email");
  const [showResendBtn, setShowResendBtn] = useState(false);
  const [isOpenResendNotice, setIsOpenResendNotice] = useState(false);
  const [isOpenResendErrNotice, setIsOpenResendErrNotice] = useState(false);
  const [resendErrMsg, setResendErrMsg] = useState("");
  const {
    isVisible: showSubmitOverlay,
    progress: submitProgress,
    iconSrc: submitIconSrc,
    start: startSubmitOverlay,
    finalize: finalizeSubmitOverlay,
    cancel: closeSubmitOverlay,
  } = useSubmitProgressOverlay();

  const onSubmit = useCallback(
    async (formData: LoginFormData) => {
      try {
        startSubmitOverlay("/icons/user-icon-default.png");

        const { error } = await authClient.signIn.email({
          email: formData.email,
          password: formData.password,
        });

        if (error) {
          closeSubmitOverlay();
          if (error.code === "INVALID_EMAIL_OR_PASSWORD") {
            setError("root", {
              type: "manual",
              message: "メールアドレスまたはパスワードが正しくありません",
            });
          } else if (error.code === "EMAIL_NOT_VERIFIED") {
            setError("root", {
              type: "manual",
              message:
                "メールアドレスが認証されていません。認証メールを確認してください",
            });
            setShowResendBtn(true);
          }
          return;
        }

        await finalizeSubmitOverlay();
        router.replace("/");
      } catch (error) {
        closeSubmitOverlay();
        console.error(error);
      }
    },
    [
      setError,
      closeSubmitOverlay,
      finalizeSubmitOverlay,
      router,
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
  } = useMultiStepForm<LoginFormData>({
    steps: LOGIN_STEPS,
    methods,
    onSubmit,
  });

  const handleChangeMode = () => {
    router.push("/signup");
  };

  const onOpenResendNotice = () => {
    setIsOpenResendNotice(true);
  };

  const onCloseResendNotice = () => {
    setIsOpenResendNotice(false);
  };

  const openResendErrNotice = () => {
    setIsOpenResendErrNotice(true);
  };

  const closeResendErrNotice = () => {
    setIsOpenResendErrNotice(false);
  };

  return (
    <div className={styles.loginWrapper}>
      <div
        className={cn(
          noAnimateStartScreen ? styles.slideUpNoAnimate : styles.slideUp,
        )}
      >
        <div className={styles.loginTitle}>ログイン</div>
        <UserIcon
          isLogin={true}
          onClick={handleChangeMode}
          hoverLocked={hoverLocked}
        />
      </div>

      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)} className={styles.formArea}>
          <div className={cn(styles.emailWrapper, inputClassName("email"))}>
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
            />
            {showResendBtn && (
              <ResendVerificationBtn
                onOpenNotice={onOpenResendNotice}
                className={styles.openResendNotice}
              />
            )}
          </div>
          <PasswordInput
            label="パスワードを入力"
            name="password"
            className={inputClassName("password")}
            onKeyDown={handleKeyDown}
            onClick={() => handleInputClick("password")}
            readOnly={!isCurrentStep("password")}
            inputRefs={inputRefs}
            hasForgotPassNotice
          />
        </form>
      </FormProvider>
      <AuthErrNotice
        isOpen={hasCurrStepErr}
        message={currStepError?.message || ""}
      />
      <AuthErrNotice
        isOpen={isOpenResendErrNotice}
        onClose={closeResendErrNotice}
        message={resendErrMsg}
        classNames={{
          content: styles.resendErrNoticeContent,
          overlay: styles.resendErrNoticeOverlay,
        }}
      />
      <ResendVerificationNotice
        isOpen={isOpenResendNotice}
        onClose={onCloseResendNotice}
        email={methods.getValues("email")}
        isOpenErrNotice={isOpenResendErrNotice}
        openErrNotice={openResendErrNotice}
        closeErrNotice={closeResendErrNotice}
        setErrMsg={setResendErrMsg}
      />
      <SubmitProgressOverlay
        visible={showSubmitOverlay}
        progress={submitProgress}
        iconSrc={submitIconSrc}
        alt="ログイン中アイコン"
        iconSize={80}
      />
    </div>
  );
}
