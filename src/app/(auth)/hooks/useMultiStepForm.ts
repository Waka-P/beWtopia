import styles from "@/app/(auth)/hooks/multiStepForm.module.scss";
import type { Step } from "@/app/types/authForm";
import { cn } from "@/lib/cn";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  FieldError,
  FieldValues,
  Path,
  UseFormReturn,
} from "react-hook-form";

type UseMultiStepFormProps<T extends FieldValues> = {
  steps: readonly Path<T>[];
  methods: UseFormReturn<T>;
  onSubmit: (data: T) => Promise<void>;
  rootErrStepIndex?: number;
  customInputClasses?: Partial<{
    inputBase: string;
    currInput: string;
    prevInput: string;
    nextInput: string;
    prevPassInput: string;
    errorInput: string;
  }>;
};

export function useMultiStepForm<T extends FieldValues>({
  steps,
  methods,
  onSubmit,
  rootErrStepIndex = 0,
  customInputClasses,
}: UseMultiStepFormProps<T>) {
  const [currentStep, setCurrentStep] = useState(0);

  const minIndex = 0;
  const maxIndex = steps.length - 1;

  const {
    handleSubmit,
    formState: { errors },
    getValues,
    clearErrors,
  } = methods;

  const inputRefs = useRef<Record<Step, HTMLInputElement | null>>({
    email: null,
    password: null,
    name: null,
    confirmPassword: null,
  });

  // Clamp関数: インデックスを範囲内に収める
  const clamp = useCallback(
    (v: number) => Math.min(Math.max(v, minIndex), maxIndex),
    [maxIndex],
  );

  // 現在のステップの値を取得
  const getCurrStepVal = useCallback(() => {
    const currStepVal = steps[currentStep];
    return getValues(currStepVal);
  }, [getValues, currentStep, steps]);

  // ステップのインデックスを取得
  const getStepIndex = useCallback(
    (name: Path<T>) => {
      return steps.indexOf(name);
    },
    [steps],
  );

  // 現在のステップかどうか
  const isCurrentStep = useCallback(
    (name: Path<T>) => {
      const stepIndex = getStepIndex(name);
      return stepIndex === currentStep;
    },
    [currentStep, getStepIndex],
  );

  // 現在のステップ情報
  const currStepName = useMemo(() => steps[currentStep], [currentStep, steps]);
  const currStepError =
    (errors[currStepName] as FieldError | undefined) ||
    (currentStep === rootErrStepIndex ? errors.root : undefined);
  const hasCurrStepErr =
    !!currStepError || (currentStep === rootErrStepIndex && !!errors.root);

  // 入力フィールドのクラス名を生成
  const inputClassName = useCallback(
    (name: Path<T>) => {
      const inputClsName = customInputClasses?.inputBase || styles.inputBase;
      const currInputCls = customInputClasses?.currInput || styles.currInput;
      const nextInputCls = customInputClasses?.nextInput || styles.nextInput;
      const prevInputCls = customInputClasses?.prevInput || styles.prevInput;
      const prevPassInputCls =
        customInputClasses?.prevPassInput || styles.prevPassInput;
      const errorInputCls = customInputClasses?.errorInput || styles.errorInput;
      const stepIndex = getStepIndex(name);

      if (stepIndex === currentStep) {
        if (hasCurrStepErr) {
          return cn(inputClsName, errorInputCls);
        } else {
          return cn(inputClsName, currInputCls);
        }
      } else if (stepIndex < currentStep) {
        if (name === "password" || name === "confirmPassword") {
          return cn(inputClsName, prevPassInputCls);
        }

        if (stepIndex === 0) {
          return cn(inputClsName, prevInputCls, styles.pI1);
        } else if (stepIndex === 1) {
          return cn(inputClsName, prevInputCls, styles.pI2);
        }

        return cn(inputClsName, prevInputCls);
      } else {
        return cn(inputClsName, nextInputCls);
      }
    },
    [currentStep, getStepIndex, hasCurrStepErr, customInputClasses],
  );

  // 入力がフォーカスされているか
  const isInputFocused = useCallback(() => {
    const el = document.activeElement;
    return el instanceof HTMLInputElement;
  }, []);

  // ステップが変わったときに入力フィールドにフォーカス
  useEffect(() => {
    const stepName = steps[currentStep];
    inputRefs.current[stepName as Step]?.focus();
  }, [currentStep, steps]);

  // エラーが発生したときに該当ステップに移動（初回のみ）
  useEffect(() => {
    const firstErrorStep = steps.find((step) => errors[step]);
    if (!firstErrorStep) return;

    const stepIndex = getStepIndex(firstErrorStep);
    // 現在のステップより後ろにエラーがある場合のみ移動
    if (stepIndex !== -1 && stepIndex < currentStep) {
      setCurrentStep(stepIndex);
    }
  }, [steps, errors, getStepIndex, currentStep]);

  // rootエラー発生時に対応するステップに移動(初回のみ)
  useEffect(() => {
    if (errors.root) {
      if (rootErrStepIndex < currentStep) {
        setCurrentStep(rootErrStepIndex);
      }
    }
  }, [errors.root, rootErrStepIndex, currentStep]);

  // 入力フィールドでのキーボード操作
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (errors.root) {
        if (e.key !== "Escape") {
          clearErrors("root");
        }
      }
      const currStepVal = getCurrStepVal();

      if (e.key === "Tab") {
        if (e.nativeEvent.isComposing) return;
        e.preventDefault();
        if (e.shiftKey) {
          setCurrentStep((i) => clamp(i - 1));
        } else {
          if (hasCurrStepErr) return;
          if (!currStepVal) return;
          setCurrentStep((i) => clamp(i + 1));
        }
        return;
      }

      if (e.key === "Enter") {
        if (e.nativeEvent.isComposing) return;
        if (hasCurrStepErr) return;
        if (!currStepVal) return;

        const isLastStep = currentStep === maxIndex;
        if (isLastStep) {
          handleSubmit(onSubmit)();
          return;
        }
        setCurrentStep((i) => clamp(i + 1));
      }

      if (e.key === "Backspace") {
        if (!currStepVal) {
          if (e.repeat) return;
          e.preventDefault();
          setCurrentStep((i) => clamp(i - 1));
        }
      }
    },
    [
      hasCurrStepErr,
      getCurrStepVal,
      clamp,
      currentStep,
      maxIndex,
      handleSubmit,
      onSubmit,
      errors.root,
      clearErrors,
    ],
  );

  // グローバルキーボードイベント（入力外での操作）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (errors.root) {
        if (e.key !== "Escape") {
          clearErrors("root");
        }
      }

      if (isInputFocused()) return;

      const currStepVal = getCurrStepVal();

      if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          setCurrentStep((i) => clamp(i - 1));
        } else {
          if (hasCurrStepErr) return;
          if (!currStepVal) return;
          setCurrentStep((i) => clamp(i + 1));
        }
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCurrentStep((i) => clamp(i - 1));
      }

      if (e.key === "ArrowDown") {
        if (hasCurrStepErr) return;
        if (!currStepVal) return;
        e.preventDefault();
        setCurrentStep((i) => clamp(i + 1));
      }

      if (e.key === "Enter") {
        if (hasCurrStepErr) return;
        if (!currStepVal) return;
        e.preventDefault();
        const isLastStep = currentStep === maxIndex;
        if (isLastStep) {
          handleSubmit(onSubmit)();
          return;
        }
        setCurrentStep((i) => clamp(i + 1));
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        setCurrentStep((i) => clamp(i - 1));
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    clamp,
    currentStep,
    getCurrStepVal,
    isInputFocused,
    handleSubmit,
    maxIndex,
    onSubmit,
    hasCurrStepErr,
    errors.root,
    clearErrors,
  ]);

  // 入力フィールドクリック時のハンドラ
  const handleInputClick = useCallback(
    (stepName: Path<T>) => {
      const stepIndex = getStepIndex(stepName);
      if (stepIndex !== -1) {
        setCurrentStep(stepIndex);
      }
    },
    [getStepIndex],
  );

  return {
    currentStep,
    setCurrentStep,
    inputRefs,
    currStepName,
    currStepError,
    hasCurrStepErr,
    isCurrentStep,
    inputClassName,
    handleInputClick,
    handleKeyDown,
    getStepIndex,
  };
}
