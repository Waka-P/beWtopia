"use client";

import {
  type BewtAPIData,
  type BewtFormData,
  bewtSchema,
} from "@/app/schemas/bewtSchema";
import { ErrorModal } from "@/components/ErrorModal";
import NumberInput from "@/components/NumberInput";
import { SubmitProgressOverlay } from "@/components/SubmitProgressOverlay";
import { useSubmitProgressOverlay } from "@/components/useSubmitProgressOverlay";
import type { AppTemplate } from "@/generated/prisma/client";
import { uploadImage, uploadZipFile } from "@/lib/cloudinary-client";
import { cn } from "@/lib/cn";
import { fetcher } from "@/utils/fetcher";
import { zodResolver } from "@hookform/resolvers/zod";
import { FocusTrap } from "focus-trap-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import styles from "../../../bewt/BewtForm.module.scss";
import { AppImagesUploader } from "../../../bewt/components/AppImagesUploader";
import { IconUploader } from "../../../bewt/components/IconUploader";
import { TemplateModal } from "../../../bewt/components/TemplateModal";
import { Toggle } from "../../../bewt/components/Toggle";
import { ZipUploader } from "../../../bewt/components/ZipUploader";
import StepIndicator from "../../../components/StepIndicator";
import { TagPicker } from "../../../components/TagPicker";

const steps = [
  {
    label: "基本情報",
    fields: [
      "name",
      "summary",
      "description",
      "tags",
      "images",
      "appFile",
    ] as const,
    requiredFields: ["name", "summary", "description", "appFile"] as const,
  },
  {
    label: "販売設定",
    fields: ["salesPlan", "paymentMethod", "trial"] as const,
    requiredFields: ["salesPlan", "paymentMethod"] as const,
  },
  {
    label: "アイコン",
    fields: ["appIcon"] as const,
    requiredFields: [] as const,
  },
];

interface Tag {
  id: number;
  name: string;
}

interface EditBewtFormProps {
  tags: Tag[];
  templates: AppTemplate[];
  appPublicId: string;
  initialValues: BewtFormData;
  initialFiles: {
    imageUrls: string[];
    appFileKey?: string | null;
    appFileSizeBytes: number | null;
    trialFileKey?: string | null;
    trialFileSizeBytes?: number | null;
    appIconUrl: string | null;
  };
}

export function EditBewtForm({
  tags,
  templates,
  appPublicId,
  initialValues,
  initialFiles,
}: EditBewtFormProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [triggeredSteps, setTriggeredSteps] = useState<Set<number>>(new Set());
  const [filesInitialized, setFilesInitialized] = useState(false);
  const [isAppFileInitializing, setIsAppFileInitializing] = useState(
    Boolean(initialFiles?.appFileKey),
  );
  const [imagesChanged, setImagesChanged] = useState(false);
  const [appFileChanged, setAppFileChanged] = useState(false);
  const [trialFileChanged, setTrialFileChanged] = useState(false);
  const [appIconChanged, setAppIconChanged] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const {
    isVisible: showSubmitOverlay,
    progress: submitProgress,
    iconSrc: submitIconSrc,
    start: startSubmitOverlay,
    finalize: finalizeSubmitOverlay,
    cancel: closeSubmitOverlay,
  } = useSubmitProgressOverlay();

  const formMethods = useForm<BewtFormData>({
    resolver: zodResolver(bewtSchema),
    mode: "onSubmit",
    defaultValues: {
      name: "",
      summary: "",
      description: "",
      tags: [],
      newTagNames: [],
      images: [],
      appFile: undefined,
      salesPlan: {
        oneTimeEnabled: false,
        oneTimePrice: null,
        monthlyEnabled: false,
        monthlyPrice: null,
      },
      paymentMethod: {
        wCoinEnabled: false,
        cardEnabled: false,
      },
      trial: {
        trialEnabled: false,
        trialDays: undefined,
        trialFile: undefined,
      },
      appIcon: null,
    },
  });

  const {
    register,
    reset,
    trigger,
    handleSubmit,
    setValue,
    control,
    clearErrors,
    formState: { errors, isSubmitting, dirtyFields },
  } = formMethods;

  // initialValues が props で更新されたときにフォーム値を反映する
  // useForm の `defaultValues` はマウント時のみ反映されるため、動的更新には `reset()` を使用する
  useEffect(() => {
    reset(initialValues);
    // ファイル系フィールド（images / appFile / appIcon など）は別の effect(filesInitialized) でセットしているため
    // ここで上書きされる懸念はありません。必要なら reset のオプションで保持挙動を調整してください。
  }, [initialValues, reset]);

  useEffect(() => {
    setIsAppFileInitializing(Boolean(initialFiles?.appFileKey));
  }, [initialFiles?.appFileKey]);

  const stepLabels = steps.map((s) => s.label);
  const description = useWatch({
    control,
    name: "description",
  });
  const salesPlan = useWatch({
    control,
    name: "salesPlan",
  });
  const trialEnabled = useWatch({
    control,
    name: "trial.trialEnabled",
  });

  const isCurrentStepTriggered = triggeredSteps.has(currentStep);

  // biome-ignore lint: 既存ファイルがあればURLから取得してフォームにセットし、その後に全ステップの初期バリデーションを実行
  useEffect(() => {
    if (filesInitialized) return;

    let cancelled = false;

    (async () => {
      try {
        if (initialFiles) {
          const { imageUrls, appFileKey, trialFileKey, appIconUrl } =
            initialFiles;

          if (imageUrls && imageUrls.length > 0) {
            const imageFiles: { file: File }[] = [];
            for (let i = 0; i < imageUrls.length; i++) {
              const url = imageUrls[i];
              try {
                const res = await fetch(url);
                if (!res.ok) continue;
                const blob = await res.blob();
                const ext = (blob.type.split("/")[1] || "img").split(";")[0];
                const file = new File([blob], `image-${i + 1}.${ext}`, {
                  type: blob.type,
                });
                imageFiles.push({ file });
              } catch {
                // 個別の画像取得エラーは無視
              }
            }
            if (!cancelled && imageFiles.length > 0) {
              setValue("images", imageFiles, {
                shouldDirty: false,
                shouldValidate: false,
              });
            }
          }

          // 既存のアプリ本体 / お試しファイルはサーバーの download API を経由して取得します
          if (appFileKey) {
            const fileName = "アプリファイル.zip";
            try {
              const res = await fetch(`/api/apps/${appPublicId}/download`);
              if (res.ok && !cancelled) {
                const blob = await res.blob();
                const file = new File([blob], fileName, {
                  type: blob.type || "application/zip",
                });

                setValue("appFile", file as unknown as File, {
                  shouldDirty: false,
                  shouldValidate: false,
                });
              }
            } catch {
              // 失敗時は何もセットせず、ユーザーに再選択してもらう
            } finally {
              if (!cancelled) {
                setIsAppFileInitializing(false);
              }
            }
          } else if (!cancelled) {
            setIsAppFileInitializing(false);
          }

          if (trialFileKey) {
            const fileName = "お試しファイル.zip";
            try {
              const res = await fetch(
                `/api/apps/${appPublicId}/download?trial=true`,
              );
              if (res.ok && !cancelled) {
                const blob = await res.blob();
                const file = new File([blob], fileName, {
                  type: blob.type || "application/zip",
                });

                setValue("trial.trialFile", file as unknown as File, {
                  shouldDirty: false,
                  shouldValidate: false,
                });
              }
            } catch {
              // ignore
            }
          }

          if (appIconUrl) {
            try {
              const res = await fetch(appIconUrl);
              if (res.ok) {
                const blob = await res.blob();
                const ext = (blob.type.split("/")[1] || "png").split(";")[0];
                const file = new File([blob], `icon.${ext}`, {
                  type: blob.type,
                });
                if (!cancelled) {
                  setValue("appIcon", file as unknown as File, {
                    shouldDirty: false,
                    shouldValidate: false,
                  });
                }
              }
            } catch {
              // 無視
            }
          }
        }

        const next = new Set<number>();
        for (let i = 0; i < steps.length; i++) {
          await trigger(steps[i].fields);
          next.add(i);
        }

        if (!cancelled) {
          setTriggeredSteps(next);
          setFilesInitialized(true);
        }
      } catch {
        if (!cancelled) {
          setFilesInitialized(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filesInitialized, initialFiles, setValue, trigger]);

  const handleFieldChange = async () => {
    if (isCurrentStepTriggered) {
      await trigger(steps[currentStep].fields);
    }
  };

  // biome-ignore lint: errors.imagesの内容が変わったら再評価（配列の内容やエラー構造の変化を検知するため、JSON.stringifyで比較）
  const imagesErrMessage = useMemo(() => {
    const imgsErr: any = errors.images;
    let imagesErrorMessage: string | null = null;
    if (imgsErr) {
      // まず配列レベルのメッセージ
      if (typeof imgsErr.message === "string") {
        imagesErrorMessage = imgsErr.message;
      } else {
        // 配列インデックスプロパティ（0,1,2,...）に個別エラーが入る場合がある
        for (const k of Object.keys(imgsErr)) {
          // skip non-numeric keys
          if (!/^[0-9]+$/.test(k)) continue;
          const itemErr = imgsErr[k];
          if (!itemErr) continue;
          // file フィールドのエラーメッセージを優先
          if (itemErr.file && typeof itemErr.file.message === "string") {
            imagesErrorMessage = itemErr.file.message;
            break;
          }
          // その他メッセージ
          if (typeof itemErr.message === "string") {
            imagesErrorMessage = itemErr.message;
            break;
          }
        }
      }
    }

    return imagesErrorMessage;
  }, [JSON.stringify(errors.images)]);

  // biome-ignore lint: dirtyFieldsのネスト構造に合わせて全必須フィールドが変更されたか判定
  useEffect(() => {
    const allRequiredFieldsDirty = steps[currentStep].requiredFields.every(
      (field) => {
        const fieldPath = field.split(".");
        let dirtyObj: any = dirtyFields;
        for (const key of fieldPath) {
          dirtyObj = dirtyObj?.[key];
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
  }, [JSON.stringify(dirtyFields), currentStep, trigger, clearErrors]);

  const isStepValid = (step: number): boolean => {
    if (!triggeredSteps.has(step)) return false;

    const hasError = steps[step].fields.some((field) => {
      const fieldPath = field.split(".");
      let errorObj: any = errors;
      for (const key of fieldPath) {
        errorObj = errorObj?.[key];
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
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleUpdate = async (data: BewtFormData) => {
    try {
      startSubmitOverlay(data.appIcon ?? null);

      const tagIds: number[] = [...data.tags];

      for (const tagName of data.newTagNames) {
        try {
          const result = await fetcher<{ tag: { id: number } }>("/api/tags", {
            method: "POST",
            body: JSON.stringify({ name: tagName }),
          });
          tagIds.push(result.tag.id);
        } catch (error) {
          console.error("Error creating tag:", error);
        }
      }

      // 画像URL: ユーザーが変更した場合のみ新規アップロードし、
      // 変更がなければ既存URLを再利用する。ただし、
      // 現在の枚数と初期枚数が異なる場合は変更ありとみなす。
      let imageUrls: string[] = [];
      const initialImageCount = initialFiles.imageUrls?.length ?? 0;
      const currentImageCount = data.images.length;

      const isImageChanged =
        imagesChanged || currentImageCount !== initialImageCount;

      if (isImageChanged && currentImageCount > 0) {
        for (let i = 0; i < data.images.length; i++) {
          const url = await uploadImage(
            data.images[i].file,
            "bewtopia/apps/product-images",
          );
          imageUrls.push(url);
        }
      } else if (isImageChanged && currentImageCount === 0) {
        // 画像を全て削除した場合は、既存画像も含めてクリア
        imageUrls = [];
      } else if (initialFiles.imageUrls?.length) {
        imageUrls = initialFiles.imageUrls;
      }

      // アプリ本体ZIP: ユーザーが変更した場合のみアップロードし、
      // 変更がなければ既存キー/URLとサイズを利用
      let appFileKey: string | undefined;
      let appFileSizeBytes: number;

      if (appFileChanged && data.appFile) {
        const uploaded = await uploadZipFile(data.appFile, "apps/files");
        appFileKey = uploaded.key;
        appFileSizeBytes = uploaded.bytes;
      } else if (initialFiles.appFileKey) {
        appFileKey = initialFiles.appFileKey ?? undefined;
        appFileSizeBytes = initialFiles.appFileSizeBytes ?? 0;
      } else {
        throw new Error("アプリファイルが指定されていません");
      }

      // アイコン
      let appIconUrl: string | undefined;
      if (appIconChanged) {
        if (data.appIcon) {
          // 新しいアイコンに差し替え
          appIconUrl = await uploadImage(data.appIcon, "bewtopia/apps/icons");
        } else {
          // アイコンを削除
          appIconUrl = undefined;
        }
      } else if (initialFiles.appIconUrl) {
        // 変更していないので既存のアイコンURLを維持
        appIconUrl = initialFiles.appIconUrl;
      }

      // お試しZIP: ユーザーが変更した場合のみアップロードし、
      // 変更がなければ既存URLをそのまま使用
      let trialData: BewtAPIData["trial"];
      if (data.trial.trialEnabled) {
        if (trialFileChanged && data.trial.trialFile) {
          const { bytes: trialFileSizeBytes, key: trialFileKey } =
            await uploadZipFile(data.trial.trialFile, "apps/trial-files");
          trialData = {
            trialEnabled: true as const,
            trialDays: data.trial.trialDays,
            trialFileKey,
            trialFileSizeBytes,
          };
        } else if (initialFiles.trialFileKey) {
          // 既存試用版ファイルのみ再利用（サイズはDBでは使っていないのでダミー値を使用）
          trialData = {
            trialEnabled: true as const,
            trialDays: data.trial.trialDays,
            trialFileKey: initialFiles.trialFileKey ?? undefined,
            trialFileSizeBytes: initialFiles.trialFileSizeBytes ?? 1,
          };
        } else {
          throw new Error("お試しファイルが指定されていません");
        }
      } else {
        trialData = {
          trialEnabled: false as const,
        };
      }

      const apiData: BewtAPIData = {
        name: data.name,
        summary: data.summary,
        description: data.description,
        tags: tagIds,
        newTagNames: [],
        imageUrls,
        appFileKey: appFileKey ?? undefined,
        appFileSizeBytes,
        appIconUrl,
        salesPlan: data.salesPlan,
        paymentMethod: data.paymentMethod,
        trial: trialData,
      };

      await fetcher<{ message: string }>(`/api/apps/${appPublicId}`, {
        method: "PUT",
        body: JSON.stringify(apiData),
      });

      await finalizeSubmitOverlay();
      router.replace(`/apps/${appPublicId}/edit/complete`);
    } catch (error) {
      console.error("更新エラー:", error);
      closeSubmitOverlay();
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "更新処理中にエラーが発生しました",
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
          onSubmit={handleSubmit(handleUpdate)}
          onKeyDown={handleFormKeyDown}
        >
          <FocusTrap
            active={!showTemplateModal}
            focusTrapOptions={{
              allowOutsideClick: true,
              clickOutsideDeactivates: false,
              escapeDeactivates: false,
            }}
          >
            <div>
              <StepIndicator
                currentStep={currentStep}
                totalSteps={3}
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
                        <label htmlFor="appTitle" className={styles.formLabel}>
                          タイトル
                        </label>
                        <input
                          className={styles.formInput}
                          type="text"
                          id="appTitle"
                          placeholder="アプリのタイトル(50文字まで)"
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
                        <label htmlFor="appDesc" className={styles.formLabel}>
                          概要
                        </label>
                        <input
                          className={styles.formInput}
                          type="text"
                          id="appDesc"
                          placeholder="アプリの概要(50文字まで)"
                          {...register("summary", {
                            onChange: handleFieldChange,
                          })}
                          autoComplete="off"
                        />
                        {errors.summary && (
                          <div className={styles.errMessage}>
                            {errors.summary.message}
                          </div>
                        )}
                      </div>

                      <div className={styles.formGroup}>
                        <label htmlFor="appDetail" className={styles.formLabel}>
                          詳細文
                        </label>
                        <label className={styles.textareaWrapper}>
                          <textarea
                            id="appDetail"
                            className={styles.formTextarea}
                            placeholder="詳細文を入力..."
                            {...register("description", {
                              onChange: handleFieldChange,
                            })}
                            autoComplete="off"
                          />
                          <div className={styles.textareaBtns}>
                            <button
                              type="button"
                              id="reset-btn"
                              className={styles.resetBtn}
                              disabled={!description?.trim()}
                              onClick={() => setValue("description", "")}
                            >
                              <Image
                                src="/images/reset.png"
                                width={96}
                                height={96}
                                alt="リセット"
                              />
                            </button>
                            <button
                              type="button"
                              id="template-btn"
                              className={styles.templateBtn}
                              onClick={() => setShowTemplateModal(true)}
                            >
                              <Image
                                src="/images/template.png"
                                alt="テンプレート"
                                width={832}
                                height={907}
                              />
                            </button>
                          </div>
                        </label>
                        {errors.description && (
                          <div className={styles.errMessage}>
                            {errors.description.message}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={styles.rightSide}>
                      <div className={styles.formGroup}>
                        <label
                          htmlFor="tagDropdownInput"
                          className={styles.formLabel}
                        >
                          タグ
                        </label>
                        <TagPicker<BewtFormData>
                          tagsFieldName="tags"
                          newTagNamesFieldName="newTagNames"
                          tags={tags}
                          onChangeCallback={handleFieldChange}
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label
                          htmlFor="appImgsInput"
                          className={styles.formLabel}
                        >
                          商品画像
                        </label>
                        <AppImagesUploader
                          onChangeCallback={() => {
                            setImagesChanged(true);
                            void handleFieldChange();
                          }}
                        />
                        {imagesErrMessage && (
                          <div className={styles.errMessage}>
                            {imagesErrMessage}
                          </div>
                        )}
                      </div>

                      <div className={styles.formGroup}>
                        <label
                          htmlFor="appFileInput"
                          className={styles.formLabel}
                        >
                          アプリファイル(ZIP形式)
                        </label>
                        <ZipUploader
                          id="appFileInput"
                          name="appFile"
                          isLoading={isAppFileInitializing}
                          onChangeCallback={() => {
                            setAppFileChanged(true);
                            void handleFieldChange();
                          }}
                        />
                        {errors.appFile && !isAppFileInitializing && (
                          <div className={styles.errMessage}>
                            {errors.appFile.message}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Panel 2: 販売設定 */}
                  <div
                    className={cn(styles.contentPanel, styles.salesSettings)}
                    inert={currentStep !== 1}
                  >
                    <div className={styles.leftSide}>
                      <div className={styles.formGroup}>
                        <p className={styles.formLabel}>販売形式</p>
                        <div className={styles.salesFormatCont}>
                          <div className={styles.oneTimeCont}>
                            <Toggle
                              id="oneTimeToggle"
                              name="salesPlan.oneTimeEnabled"
                              label="買い切り"
                              onChangeCallback={handleFieldChange}
                            />
                            <div
                              className={cn(
                                styles.priceInputCont,
                                salesPlan?.oneTimeEnabled && styles.open,
                              )}
                            >
                              <label
                                htmlFor="oneTimePrice"
                                className={styles.formLabel}
                              >
                                価格
                              </label>
                              <div className={styles.inputTextWrapper}>
                                <NumberInput
                                  type="number"
                                  id="oneTimePrice"
                                  className={styles.formInput}
                                  placeholder="価格を入力"
                                  min="1"
                                  step="1"
                                  {...register("salesPlan.oneTimePrice", {
                                    setValueAs: (v) =>
                                      v === "" || v === null ? null : Number(v),
                                    onChange: handleFieldChange,
                                  })}
                                  autoComplete="off"
                                />
                                <span>円</span>
                              </div>
                              {errors.salesPlan?.oneTimePrice && (
                                <div className={styles.errMessage}>
                                  {errors.salesPlan.oneTimePrice.message}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className={styles.monthlyCont}>
                            <Toggle
                              id="monthlyToggle"
                              name="salesPlan.monthlyEnabled"
                              label="サブスク"
                              onChangeCallback={handleFieldChange}
                            />
                            <div
                              className={cn(
                                styles.priceInputCont,
                                salesPlan?.monthlyEnabled && styles.open,
                              )}
                            >
                              <label
                                htmlFor="monthlyPrice"
                                className={styles.formLabel}
                              >
                                月額
                              </label>
                              <div className={styles.inputTextWrapper}>
                                <input
                                  type="number"
                                  id="monthlyPrice"
                                  className={styles.formInput}
                                  placeholder="価格を入力"
                                  min="1"
                                  step="1"
                                  {...register("salesPlan.monthlyPrice", {
                                    setValueAs: (v) =>
                                      v === "" || v === null ? null : Number(v),
                                    onChange: handleFieldChange,
                                  })}
                                  autoComplete="off"
                                />
                                <span>円/月</span>
                              </div>
                              {errors.salesPlan?.monthlyPrice && (
                                <div className={styles.errMessage}>
                                  {errors.salesPlan.monthlyPrice.message}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {errors.salesPlan && (
                          <div className={styles.errMessage}>
                            {errors.salesPlan.message}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={styles.rightSide}>
                      <div className={styles.formGroup}>
                        <p className={styles.formLabel}>決済方法</p>
                        <div className={styles.paymentMethodCont}>
                          <label className={styles.checkbox}>
                            <input
                              type="checkbox"
                              {...register("paymentMethod.cardEnabled", {
                                onChange: handleFieldChange,
                              })}
                            />
                            <span className={styles.checkmark}></span>
                            <div className={styles.methodNameWrapper}>
                              <span>クレジットカード</span>
                              <Image
                                src="/images/creditcard.png"
                                alt="クレジットカード"
                                width={190}
                                height={148}
                                className={styles.methodIcon}
                              />
                            </div>
                          </label>
                          <label className={styles.checkbox}>
                            <input
                              type="checkbox"
                              {...register("paymentMethod.wCoinEnabled", {
                                onChange: handleFieldChange,
                              })}
                            />
                            <span className={styles.checkmark}></span>
                            <div className={styles.methodNameWrapper}>
                              <span>Wコイン</span>
                              <Image
                                src="/images/w-coin.png"
                                alt="Wコイン"
                                width={582}
                                height={554}
                                className={styles.methodIcon}
                              />
                            </div>
                          </label>
                        </div>
                        {errors.paymentMethod && (
                          <div className={styles.errMessage}>
                            {errors.paymentMethod.message}
                          </div>
                        )}
                      </div>

                      <div className={styles.formGroup}>
                        <p className={styles.formLabel}>お試し機能</p>
                        <div className={styles.trialCont}>
                          <Toggle
                            id="trialToggle"
                            name="trial.trialEnabled"
                            label="お試し機能"
                            onChangeCallback={handleFieldChange}
                          />
                          <div
                            className={cn(
                              styles.trialFormCont,
                              trialEnabled && styles.open,
                            )}
                          >
                            <div className={styles.formGroup}>
                              <label
                                htmlFor="trialDays"
                                className={styles.formLabel}
                              >
                                お試し日数
                              </label>
                              <div className={styles.inputTextWrapper}>
                                <input
                                  type="number"
                                  id="trialDays"
                                  className={styles.formInput}
                                  placeholder="例：7"
                                  min="1"
                                  step="1"
                                  {...register("trial.trialDays", {
                                    setValueAs: (v) =>
                                      v === "" ? undefined : Number(v),
                                    onChange: handleFieldChange,
                                  })}
                                  autoComplete="off"
                                />
                                <span>日</span>
                              </div>
                              {errors.trial?.trialDays && (
                                <div className={styles.errMessage}>
                                  {errors.trial.trialDays.message}
                                </div>
                              )}
                            </div>

                            <div className={styles.formGroup}>
                              <label
                                htmlFor="trialAppFileInput"
                                className={styles.formLabel}
                              >
                                機能制限版アプリファイル(ZIP形式)
                              </label>
                              <ZipUploader
                                id="trialAppFileInput"
                                name="trial.trialFile"
                                onChangeCallback={() => {
                                  setTrialFileChanged(true);
                                  void handleFieldChange();
                                }}
                              />
                              {errors.trial?.trialFile && (
                                <div className={styles.errMessage}>
                                  {errors.trial.trialFile.message}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Panel 3: アイコン */}
                  <div
                    className={cn(styles.contentPanel, styles.iconUpload)}
                    inert={currentStep !== 2}
                  >
                    <div
                      className={cn(styles.formGroup, styles.iconUploadGroup)}
                    >
                      <label
                        htmlFor="icon-file-input"
                        className={styles.formLabel}
                      >
                        アイコン
                      </label>
                      <IconUploader
                        id="icon-file-input"
                        onChangeCallback={() => {
                          setAppIconChanged(true);
                          void handleFieldChange();
                        }}
                      />
                      {errors.appIcon && (
                        <div className={styles.errMessage}>
                          {errors.appIcon.message}
                        </div>
                      )}
                    </div>
                    <button
                      type="submit"
                      id="bewtUpdateBtn"
                      className={cn(styles.bewtBtn, {
                        [styles.disabled]: isSubmitting,
                      })}
                      disabled={isSubmitting}
                    >
                      更新
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.navigation}>
                {currentStep === 0 ? (
                  <button
                    type="button"
                    className={styles.prevBtn}
                    onClick={() => router.back()}
                    disabled={isSubmitting}
                  >
                    キャンセル
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.prevBtn}
                    onClick={handlePrev}
                    disabled={isSubmitting}
                  >
                    戻る
                  </button>
                )}
                <button
                  type="button"
                  className={cn(
                    styles.nextBtn,
                    currentStep === 2 && styles.hidden,
                  )}
                  onClick={handleNext}
                  disabled={
                    currentStep === 2 ||
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
        <TemplateModal
          open={showTemplateModal}
          templates={templates}
          onSelect={(content) => {
            setValue("description", content, {
              shouldDirty: true,
              shouldValidate: true,
              shouldTouch: true,
            });
            setShowTemplateModal(false);
          }}
          onClose={() => setShowTemplateModal(false)}
        />
      </FormProvider>
      <ErrorModal
        open={!!errorMessage}
        title="アプリ更新エラー"
        message={errorMessage ?? ""}
        onClose={() => setErrorMessage(null)}
      />
      <SubmitProgressOverlay
        visible={showSubmitOverlay}
        progress={submitProgress}
        iconSrc={submitIconSrc}
        iconSize={200}
      />
    </div>
  );
}
