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
import StepIndicator from "../components/StepIndicator";
import { TagPicker } from "../components/TagPicker";
import styles from "./BewtForm.module.scss";
import { AppImagesUploader } from "./components/AppImagesUploader";
import { IconUploader } from "./components/IconUploader";
import { TemplateModal } from "./components/TemplateModal";
import { Toggle } from "./components/Toggle";
import { ZipUploader } from "./components/ZipUploader";

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

interface BewtFormProps {
  tags: Tag[];
  templates: AppTemplate[];
  // 共同出品（ビューズ）など文言を切り替えたい場合に利用
  submitLabel?: string;
  // ビューズプロジェクトからの共同出品時に紐付けるための publicId
  bewtsProjectPublicId?: string;
  // 出品完了後のリダイレクト先（デフォルトは通常のビュート完了ページ）
  afterSuccessUrl?: string;
}

export function BewtForm({
  tags,
  templates,
  submitLabel = "ビュート",
  bewtsProjectPublicId,
  afterSuccessUrl,
}: BewtFormProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  // 各ステップでtriggerが実行されたかどうかを追跡
  const [triggeredSteps, setTriggeredSteps] = useState<Set<number>>(new Set());
  // trial系の入力だけでステップボタンの有効/無効を判定するためのフラグ
  const [isTrialValidForStep, setIsTrialValidForStep] = useState(true);
  // 販売形式(salesPlan)の入力だけでステップボタンの有効/無効を判定するためのフラグ
  const [isSalesPlanValidForStep, setIsSalesPlanValidForStep] = useState(true);
  // お試しZIPファイルのローカル/サーバーバリデーション中フラグ
  const [isTrialFileValidating, setIsTrialFileValidating] = useState(false);
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
    trigger,
    handleSubmit,
    setValue,
    setError,
    control,
    clearErrors,
    getValues,
    formState: { errors, isSubmitting, dirtyFields },
  } = formMethods;

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

  // 現在のステップでtriggerが実行されたかどうか
  const isCurrentStepTriggered = triggeredSteps.has(currentStep);

  // フィールドの値が変更された時に、triggerが実行済みならバリデーションを実行
  const handleFieldChange = async (eventOrFieldName?: any) => {
    let fieldName: string | undefined;

    if (typeof eventOrFieldName === "string") {
      // カスタムコンポーネント（ZipUploader など）からフィールド名だけ渡された場合
      fieldName = eventOrFieldName;
    } else {
      const target = eventOrFieldName?.target as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
        | undefined;
      fieldName = target?.name;
    }

    if (
      fieldName &&
      (fieldName.startsWith("trial.") || fieldName.startsWith("salesPlan."))
    ) {
      const values = getValues();
      const parsed = bewtSchema.safeParse(values);

      if (!parsed.success) {
        const hasTrialError = parsed.error.issues.some(
          (issue) => issue.path[0] === "trial",
        );
        const hasSalesPlanError = parsed.error.issues.some(
          (issue) => issue.path[0] === "salesPlan",
        );
        setIsTrialValidForStep(!hasTrialError);
        setIsSalesPlanValidForStep(!hasSalesPlanError);
      } else {
        setIsTrialValidForStep(true);
        setIsSalesPlanValidForStep(true);
      }
    }

    //  一度 trigger 済みのステップは、入力変更のたびに再評価
    if (isCurrentStepTriggered) {
      await trigger(steps[currentStep].fields);
    }
  };

  // biome-ignore lint: dirtyFieldsが変更されたら、現在のステップの必須フィールドが全て汚れた場合のみtriggerを実行
  useEffect(() => {
    // 現在のステップの必須フィールドが全てdirtyかチェック
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
      // 非同期でtriggerを実行し、triggeredStepsに追加
      (async () => {
        await trigger(steps[currentStep].fields);
        clearErrors(steps[currentStep].fields);
        setTriggeredSteps((prev) => new Set(prev).add(currentStep));
      })();
    }
  }, [JSON.stringify(dirtyFields), currentStep, trigger]);

  // StepIndicator用: triggerを実行せず、errorsオブジェクトから判定
  const isStepValid = (step: number): boolean => {
    // triggerされていないステップは無効
    if (!triggeredSteps.has(step)) return false;

    // お試しZIPのバリデーション中は、販売設定ステップを「未完了」とみなす
    if (step === 1 && isTrialFileValidating) {
      return false;
    }

    // そのステップの全フィールドにエラーがないかチェック
    const hasError = steps[step].fields.some((field) => {
      const fieldPath = field.split(".");
      let errorObj: any = errors;
      for (const key of fieldPath) {
        errorObj = errorObj?.[key];
        if (!errorObj) break;
      }
      return !!errorObj;
    });

    if (hasError) return false;

    if (step === 1 && (!isTrialValidForStep || !isSalesPlanValidForStep)) {
      return false;
    }

    return true;
  };

  const handleStepClick = async (step: number) => {
    if (step === currentStep) return;
    if (step > currentStep) {
      const isValid = await trigger(steps[currentStep].fields);
      // triggerを実行したステップを記録
      setTriggeredSteps((prev) => new Set(prev).add(currentStep));
      if (!isValid) return;
    }
    setCurrentStep(step);
  };

  const handleNext = async () => {
    const isValid = await trigger(steps[currentStep].fields);
    // triggerを実行したステップを記録
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

  const handleBewt = async (data: BewtFormData) => {
    try {
      startSubmitOverlay(data.appIcon ?? null);

      // 1. 新しいタグをDBに保存し、IDを取得
      console.log("新しいタグを処理中...");
      const tagIds: number[] = [...data.tags]; // 既存タグIDをコピー

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

      // 2. ファイルをアップロード（画像 → Cloudinary、ZIP → Cloudflare R2）
      console.log("ファイルをアップロード中...");

      // 商品画像をアップロード
      const imageUrls: string[] = [];
      for (let i = 0; i < data.images.length; i++) {
        const url = await uploadImage(
          data.images[i].file,
          "bewtopia/apps/product-images",
        );
        imageUrls.push(url);
      }

      // アプリファイルをアップロード
      const { bytes: appFileSizeBytes, key: appFileKey } = await uploadZipFile(
        data.appFile,
        "apps/files",
      );

      // アイコンをアップロード（オプショナル）
      let appIconUrl: string | undefined;
      if (data.appIcon) {
        appIconUrl = await uploadImage(data.appIcon, "bewtopia/apps/icons");
      }

      // お試しファイルをアップロード（オプショナル）
      let trialData: BewtAPIData["trial"];
      if (data.trial.trialEnabled) {
        try {
          const { bytes: trialFileSizeBytes, key: trialFileKey } =
            await uploadZipFile(data.trial.trialFile, "apps/trial-files");
          trialData = {
            trialEnabled: true as const,
            trialDays: data.trial.trialDays,
            trialFileKey,
            trialFileSizeBytes,
          };
        } catch (error) {
          console.error("お試しファイルアップロードエラー:", error);
          const message =
            error instanceof Error && error.message
              ? error.message
              : "お試しファイルのアップロードに失敗しました";
          setError("trial.trialFile", {
            type: "manual",
            message,
          });
          // APIレベルのエラーはフィールドエラーとして表示し、
          // それ以上の処理は行わない
          return;
        }
      } else {
        trialData = {
          trialEnabled: false as const,
        };
      }

      // 3. キーを含むデータをAPIに送信
      const apiData: BewtAPIData = {
        name: data.name,
        summary: data.summary,
        description: data.description,
        tags: tagIds, // 既存タグIDと新規作成されたタグIDの配列
        newTagNames: [], // API送信時は空配列
        imageUrls,
        appFileKey: appFileKey,
        appFileSizeBytes,
        appIconUrl,
        salesPlan: data.salesPlan,
        paymentMethod: data.paymentMethod,
        trial: trialData,
      };

      if (bewtsProjectPublicId) {
        apiData.bewtsProjectPublicId = bewtsProjectPublicId;
      }

      console.log("アプリデータを送信中...");
      // API呼び出し
      const res = await fetcher<{
        success?: boolean;
        appId?: string;
        message?: string;
      }>("/api/bewt", {
        method: "POST",
        body: JSON.stringify(apiData),
      });

      // 出品完了ページの URL に作成した app の publicId を付与して遷移
      const baseUrl = afterSuccessUrl ?? "/bewt/complete";
      const appQuery = res?.appId
        ? `bewtedId=${encodeURIComponent(res.appId)}`
        : null;
      const targetUrl = appQuery
        ? baseUrl.includes("?")
          ? `${baseUrl}&${appQuery}`
          : `${baseUrl}?${appQuery}`
        : baseUrl;
      await finalizeSubmitOverlay();
      router.push(targetUrl);
    } catch (error) {
      console.error("ビュートエラー:", error);
      closeSubmitOverlay();
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "ビュート処理中にエラーが発生しました",
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

  return (
    <div className={styles.container}>
      <FormProvider {...formMethods}>
        <form onSubmit={handleSubmit(handleBewt)} onKeyDown={handleFormKeyDown}>
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
                          onChangeCallback={handleFieldChange}
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
                          onChangeCallback={handleFieldChange}
                        />
                        {errors.appFile && (
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
                                <NumberInput
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
                                <NumberInput
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
                                maxSizeBytes={50 * 1024 * 1024}
                                maxSizeErrorMessage="お試しファイルのサイズが大きすぎます。50MB以下のZIPファイルをアップロードしてください。"
                                validateEndpoint="/api/bewt/trial/validate"
                                onChangeCallback={handleFieldChange}
                                onValidatingChange={setIsTrialFileValidating}
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
                        onChangeCallback={handleFieldChange}
                      />
                      {errors.appIcon && (
                        <div className={styles.errMessage}>
                          {errors.appIcon.message}
                        </div>
                      )}
                    </div>
                    <button
                      type="submit"
                      id="bewtBtn"
                      className={cn(styles.bewtBtn, {
                        [styles.disabled]: isSubmitting,
                      })}
                      disabled={isSubmitting}
                    >
                      {submitLabel}
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
        title="ビュートエラー"
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
