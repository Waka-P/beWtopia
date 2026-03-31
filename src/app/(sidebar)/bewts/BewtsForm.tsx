"use client";

import { type BewtsFormData, bewtsSchema } from "@/app/schemas/bewtsSchema";
import { ErrorModal } from "@/components/ErrorModal";
import NumberInput from "@/components/NumberInput";
import { SubmitProgressOverlay } from "@/components/SubmitProgressOverlay";
import { useSubmitProgressOverlay } from "@/components/useSubmitProgressOverlay";
import type { Skill } from "@/generated/prisma/browser";
import { BewtsProjectStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/cn";
import { fetcher } from "@/utils/fetcher";
import { zodResolver } from "@hookform/resolvers/zod";
import { FocusTrap } from "focus-trap-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FormProvider, useFieldArray, useForm } from "react-hook-form";
import { SkillPicker } from "../components/SkillPicker";
import StepIndicator from "../components/StepIndicator";
import styles from "./BewtsForm.module.scss";

const steps = [
  {
    label: "プロジェクト概要",
    fields: ["name", "description", "skills"] as const,
    requiredFields: ["name", "description"] as const,
  },
  {
    label: "募集条件",
    fields: [
      "memberCount",
      "durationDays",
      "leaderSharePercentage",
      "roles",
    ] as const,
    requiredFields: [
      "memberCount",
      "durationDays",
      "leaderSharePercentage",
      "roles",
    ] as const,
  },
];

interface BewtsFormProps {
  skills: Skill[];
  mode?: "create" | "edit";
  projectPublicId?: string;
  initialValues?: Partial<BewtsFormData>;
  minMemberCount?: number;
  lockedRoleIds?: number[];
}

const DESC_MAX_LENGTH = 2000;

export function BewtsForm({
  skills,
  mode = "create",
  projectPublicId,
  initialValues,
  minMemberCount = 1,
  lockedRoleIds = [],
}: BewtsFormProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [triggeredSteps, setTriggeredSteps] = useState<Set<number>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const {
    isVisible: showSubmitOverlay,
    progress: submitProgress,
    iconSrc: submitIconSrc,
    start: startSubmitOverlay,
    finalize: finalizeSubmitOverlay,
    cancel: closeSubmitOverlay,
  } = useSubmitProgressOverlay();

  const formMethods = useForm<BewtsFormData>({
    resolver: zodResolver(bewtsSchema),
    mode: "onSubmit",
    defaultValues: {
      name: "",
      description: "",
      skills: [],
      memberCount: 1,
      durationDays: 30,
      leaderSharePercentage: 20,
      roles: [{ name: "", sharePercentage: 80 }],
      status: BewtsProjectStatus.RECRUITING,
    },
  });

  const {
    register,
    trigger,
    handleSubmit,
    reset,
    control,
    clearErrors,
    setError,
    watch,
    formState: { errors, isSubmitting, dirtyFields },
  } = formMethods;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "roles",
  });

  const stepLabels = steps.map((s) => s.label);
  const description = watch("description");
  const leaderPercentage = watch("leaderSharePercentage");
  const roles = watch("roles");
  const lockedRoleIdSet = new Set(lockedRoleIds);

  useEffect(() => {
    if (!initialValues) return;
    reset({
      name: initialValues.name ?? "",
      description: initialValues.description ?? "",
      skills: initialValues.skills ?? [],
      memberCount: initialValues.memberCount ?? 1,
      durationDays: initialValues.durationDays ?? 30,
      leaderSharePercentage: initialValues.leaderSharePercentage ?? 20,
      roles:
        initialValues.roles && initialValues.roles.length > 0
          ? initialValues.roles
          : [{ name: "", sharePercentage: 80 }],
      status: initialValues.status ?? BewtsProjectStatus.RECRUITING,
    });
  }, [initialValues, reset]);

  // biome-ignore lint: 編集モードで初期値がある場合、最初のステップを自動的にトリガーしてエラーを表示
  useEffect(() => {
    if (mode === "edit" && initialValues) {
      (async () => {
        await trigger(steps[currentStep].fields);
        setTriggeredSteps((prev) => new Set(prev).add(currentStep));
      })();
    }
  }, [mode, initialValues]);

  const isCurrentStepTriggered = triggeredSteps.has(currentStep);

  const handleFieldChange = async () => {
    if (isCurrentStepTriggered) {
      await trigger(steps[currentStep].fields);
    }
  };

  // 役割の配分率が変更されたときのハンドラ
  const handleRolePercentageChange = async () => {
    if (isCurrentStepTriggered) {
      // leaderSharePercentageとrolesの両方を再検証
      await trigger();
    }
  };

  // biome-ignore lint: dirtyFieldsが変更されたら、現在のステップの必須フィールドが全て汚れた場合のみtriggerを実行
  useEffect(() => {
    const allRequiredFieldsDirty = steps[currentStep].requiredFields.every(
      (field) => {
        const fieldPath = field.split(".");
        let dirtyObj: unknown = dirtyFields;
        for (const key of fieldPath) {
          dirtyObj = dirtyObj?.[key as keyof typeof dirtyObj];
          if (!dirtyObj) return false;
        }
        return !!dirtyObj;
      },
    );

    if (allRequiredFieldsDirty) {
      (async () => {
        await trigger(steps[currentStep].fields);
        clearErrors(steps[currentStep].fields);
        setTriggeredSteps((prev) => new Set(prev).add(currentStep));
      })();
    }
  }, [JSON.stringify(dirtyFields), currentStep, trigger]);

  // biome-ignore lint: leaderSharePercentageかrolesが変更されたら、配分率の合計をチェックしてエラーを設定
  useEffect(() => {
    const total =
      leaderPercentage +
      roles.reduce((s, r) => s + (r.sharePercentage ?? 0), 0);

    if (total !== 100) {
      setError("root", {
        type: "manual",
        message: `配分率の合計が100%になるように設定してください（現在: ${total}%）`,
      });
    } else {
      clearErrors("root");
    }
  }, [
    leaderPercentage,
    JSON.stringify(roles),
    setError,
    clearErrors,
    isSubmitting,
  ]);

  const isStepValid = (step: number): boolean => {
    if (!triggeredSteps.has(step)) return false;

    const hasError = steps[step].fields.some((field) => {
      const fieldPath = field.split(".");
      let errorObj: unknown = errors;
      for (const key of fieldPath) {
        errorObj = errorObj?.[key as keyof typeof errorObj];
        if (!errorObj) break;
      }
      return !!errorObj;
    });

    return !hasError;
  };

  const handleStepClick = async (step: number) => {
    if (step === currentStep) return;
    if (step > currentStep) {
      const isValid = await trigger(steps[currentStep].fields);
      setTriggeredSteps((prev) => new Set(prev).add(currentStep));
      if (!isValid) return;
    }
    setCurrentStep(step);
  };

  const handleNext = async () => {
    const isValid = await trigger(steps[currentStep].fields);
    setTriggeredSteps((prev) => new Set(prev).add(currentStep));
    if (!isValid) return;
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleBewts = async (data: BewtsFormData) => {
    try {
      startSubmitOverlay("/icons/sidebar/bewts-filled.png");

      if (mode === "edit") {
        if (!projectPublicId) {
          throw new Error("編集対象のプロジェクトIDが不足しています");
        }
        await fetcher<{ message: string }>(`/api/bewts/${projectPublicId}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });

        await finalizeSubmitOverlay();
        router.replace("/bewts/edit/complete");
        return;
      }

      await fetcher<{ message: string }>("/api/bewts", {
        method: "POST",
        body: JSON.stringify(data),
      });

      await finalizeSubmitOverlay();
      router.replace("/bewts/new/complete");
    } catch (error) {
      console.error("募集作成エラー:", error);
      closeSubmitOverlay();
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "募集作成中にエラーが発生しました",
      );
    }
  };

  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    const { key, target } = e;

    if (key !== "Enter" || target instanceof HTMLTextAreaElement) {
      return;
    }

    e.preventDefault();
  };

  return (
    <div className={styles.container}>
      <FormProvider {...formMethods}>
        <form
          onSubmit={handleSubmit(handleBewts)}
          onKeyDown={handleFormKeyDown}
        >
          <FocusTrap
            active={true}
            focusTrapOptions={{
              allowOutsideClick: true,
              clickOutsideDeactivates: false,
              escapeDeactivates: false,
            }}
          >
            <div>
              <StepIndicator
                currentStep={currentStep}
                totalSteps={steps.length}
                stepLabels={stepLabels}
                onStepClick={handleStepClick}
                isStepValid={isStepValid}
              />

              <div className={styles.contentSlider}>
                <div
                  className={styles.contentWrapper}
                  style={{ transform: `translateX(-${currentStep * 100}%)` }}
                >
                  {/* Panel 1: 基本情報 */}
                  <div
                    className={cn(styles.contentPanel, styles.basicInfo)}
                    inert={currentStep !== 0}
                  >
                    <div className={styles.leftSide}>
                      <div className={styles.formGroup}>
                        <label
                          htmlFor="projectName"
                          className={styles.formLabel}
                        >
                          プロジェクト名
                        </label>
                        <input
                          className={styles.formInput}
                          type="text"
                          id="projectName"
                          placeholder="プロジェクトの名前（50文字まで）"
                          {...register("name", {
                            onChange: handleFieldChange,
                          })}
                          autoComplete="off"
                        />
                        {errors.name && (
                          <div className={styles.errMessage}>
                            {errors.name.message}
                          </div>
                        )}
                      </div>

                      <div className={styles.formGroup}>
                        <label
                          htmlFor="projectSkills"
                          className={styles.formLabel}
                        >
                          募集スキル
                        </label>
                        <SkillPicker<BewtsFormData>
                          skillsFieldName="skills"
                          skills={skills}
                        />
                        {errors.skills && (
                          <div className={styles.errMessage}>
                            {errors.skills.message}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={styles.rightSide}>
                      <div className={styles.formGroup}>
                        <label
                          htmlFor="projectDesc"
                          className={styles.formLabel}
                        >
                          プロジェクト概要
                        </label>
                        <textarea
                          id="projectDesc"
                          className={styles.formTextarea}
                          placeholder="プロジェクトの説明文を入力..."
                          {...register("description", {
                            onChange: handleFieldChange,
                          })}
                          autoComplete="off"
                        />
                        <div className={styles.errAndCounter}>
                          {errors.description && (
                            <p className={styles.errMessage}>
                              {errors.description.message}
                            </p>
                          )}
                          <span
                            className={cn(
                              styles.counter,
                              description.length > DESC_MAX_LENGTH &&
                                styles.counterError,
                            )}
                          >
                            {description.length} / {DESC_MAX_LENGTH}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Panel 2: 募集設定 */}
                  <div
                    className={cn(
                      styles.contentPanel,
                      styles.recruitmentSettings,
                    )}
                    inert={currentStep !== 1}
                  >
                    <div className={styles.settingsCont}>
                      <div className={styles.leftSide}>
                        <div className={styles.formGroup}>
                          <label
                            htmlFor="memberCount"
                            className={styles.formLabel}
                          >
                            募集人数
                          </label>
                          <div className={styles.inputTextWrapper}>
                            <NumberInput
                              className={styles.formInput}
                              type="number"
                              id="memberCount"
                              placeholder="人数"
                              min={minMemberCount}
                              {...register("memberCount", {
                                valueAsNumber: true,
                                onChange: handleFieldChange,
                                validate: (value) =>
                                  value >= minMemberCount ||
                                  `募集人数は${minMemberCount}人以上で入力してください`,
                              })}
                              autoComplete="off"
                            />
                            <span>人</span>
                          </div>
                          {errors.memberCount && (
                            <div className={styles.errMessage}>
                              {errors.memberCount.message}
                            </div>
                          )}
                        </div>

                        <div className={styles.formGroup}>
                          <label
                            htmlFor="durationDays"
                            className={styles.formLabel}
                          >
                            開発期間（日）
                          </label>
                          <div className={styles.inputTextWrapper}>
                            <NumberInput
                              className={styles.formInput}
                              type="number"
                              id="durationDays"
                              placeholder="例：60"
                              {...register("durationDays", {
                                valueAsNumber: true,
                                onChange: handleFieldChange,
                              })}
                              autoComplete="off"
                            />
                            <span>日</span>
                          </div>
                          {errors.durationDays && (
                            <div className={styles.errMessage}>
                              {errors.durationDays.message}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={styles.rightSide}>
                        <div className={styles.formGroup}>
                          <p className={styles.formLabel}>役割・配分設定</p>
                          <div className={styles.rolesCard}>
                            {/* リーダー（固定） */}
                            <div className={styles.roleRow}>
                              <span
                                className={cn(
                                  styles.roleLabel,
                                  styles.leaderLabel,
                                )}
                              >
                                リーダー
                              </span>
                              <div className={styles.inputTextWrapper}>
                                <input
                                  className={cn(
                                    styles.formInput,
                                    styles.percentageInput,
                                  )}
                                  type="number"
                                  {...register("leaderSharePercentage", {
                                    valueAsNumber: true,
                                    onChange: handleRolePercentageChange,
                                  })}
                                />
                                <span>%</span>
                              </div>
                              {fields.length > 1 && (
                                <span className={styles.removeRoleSpacer} />
                              )}
                            </div>
                            {errors.leaderSharePercentage && (
                              <div className={styles.errMessage}>
                                {errors.leaderSharePercentage.message}
                              </div>
                            )}

                            {/* 動的な役割 */}
                            {fields.map((field, index) => (
                              <div key={field.id}>
                                <div className={styles.roleRow}>
                                  <input
                                    className={cn(
                                      styles.formInput,
                                      styles.roleNameInput,
                                    )}
                                    type="text"
                                    placeholder="役割名"
                                    {...register(`roles.${index}.name`, {
                                      onChange: handleFieldChange,
                                    })}
                                    autoComplete="off"
                                  />
                                  <div className={styles.inputTextWrapper}>
                                    <NumberInput
                                      className={cn(
                                        styles.formInput,
                                        styles.percentageInput,
                                      )}
                                      type="number"
                                      {...register(
                                        `roles.${index}.sharePercentage`,
                                        {
                                          valueAsNumber: true,
                                          onChange: handleRolePercentageChange,
                                        },
                                      )}
                                    />
                                    <span>%</span>
                                  </div>
                                  {fields.length > 1 && (
                                    <button
                                      type="button"
                                      className={styles.removeRoleBtn}
                                      disabled={
                                        typeof field.roleId === "number" &&
                                        lockedRoleIdSet.has(field.roleId)
                                      }
                                      onClick={() => remove(index)}
                                    >
                                      <Image
                                        src="/images/remove.png"
                                        alt="削除"
                                        width={330}
                                        height={334}
                                        className={styles.removeIcon}
                                      />
                                    </button>
                                  )}
                                </div>
                                {errors?.roles?.[index]?.name && (
                                  <div className={styles.errMessage}>
                                    {errors.roles[index]?.name?.message}
                                  </div>
                                )}
                                {errors?.roles?.[index]?.sharePercentage && (
                                  <div className={styles.errMessage}>
                                    {
                                      errors.roles[index]?.sharePercentage
                                        ?.message
                                    }
                                  </div>
                                )}
                              </div>
                            ))}
                            {errors.root && (
                              <div className={styles.errMessage}>
                                {errors.root.message}
                              </div>
                            )}

                            {/* 役割追加ボタン */}
                            <button
                              type="button"
                              className={styles.addRoleBtn}
                              onClick={() =>
                                append({ name: "", sharePercentage: 0 })
                              }
                              disabled={fields.length >= 10}
                            >
                              <span className={styles.plusIcon}>＋</span>
                              役割を追加
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className={cn(styles.bewtsBtn, {
                        [styles.disabled]: isSubmitting,
                      })}
                      disabled={isSubmitting}
                    >
                      {isSubmitting
                        ? mode === "edit"
                          ? "更新中..."
                          : "作成中..."
                        : mode === "edit"
                          ? "更新"
                          : "作成"}
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.navigation}>
                <button
                  type="button"
                  className={cn(
                    styles.prevBtn,
                    currentStep === 0 && styles.hidden,
                  )}
                  onClick={handlePrev}
                  disabled={currentStep === 0 || isSubmitting}
                >
                  戻る
                </button>
                <button
                  type="button"
                  className={cn(
                    styles.nextBtn,
                    currentStep === steps.length - 1 && styles.hidden,
                  )}
                  onClick={handleNext}
                  disabled={
                    currentStep === steps.length - 1 ||
                    isSubmitting ||
                    !isStepValid(currentStep)
                  }
                >
                  次へ
                </button>
              </div>
            </div>
          </FocusTrap>
        </form>
      </FormProvider>
      <ErrorModal
        open={!!errorMessage}
        title={mode === "edit" ? "プロジェクト更新エラー" : "募集作成エラー"}
        message={errorMessage ?? ""}
        onClose={() => setErrorMessage(null)}
      />
      <SubmitProgressOverlay
        visible={showSubmitOverlay}
        progress={submitProgress}
        iconSrc={submitIconSrc}
        alt="募集送信中アイコン"
        iconSize={80}
      />
    </div>
  );
}
