import { cn } from "@/lib/cn";
import Image from "next/image";
import styles from "./StepIndicator.module.scss";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
  onStepClick: (step: number) => void;
  isStepValid: (step: number) => boolean;
}

export default function StepIndicator({
  currentStep,
  totalSteps,
  stepLabels,
  onStepClick,
  isStepValid,
}: StepIndicatorProps) {
  const isStepDisabled = (step: number) => {
    if (step <= currentStep) return false;
    for (let i = 0; i < step; i++) {
      if (!isStepValid(i)) return true;
    }
    return false;
  };

  const totalSegments = totalSteps - 1;
  const progressPercentage = (currentStep / totalSegments) * 100;
  const clampedProgress = Math.min(progressPercentage, 100);

  return (
    <div className={styles.stepIndicator}>
      {Array.from({ length: totalSteps }).map((_, index) => {
        const disabled = isStepDisabled(index);
        const active = index === currentStep;

        return (
          <button
            type="button"
            // biome-ignore lint: indexの順番が前後することはないため
            key={index}
            className={cn(
              styles.step,
              active && styles.active,
              disabled && styles.disabled,
            )}
            data-step={index}
            onClick={() => !disabled && onStepClick(index)}
            tabIndex={disabled ? -1 : 0}
            disabled={disabled}
            onKeyDown={(e) => {
              if (!disabled && (e.key === "Enter" || e.key === " ")) {
                onStepClick(index);
              }
            }}
          >
            <div
              className={cn(styles.stepCircle, {
                [styles.completed]: index < currentStep,
                [styles.current]: index === currentStep,
                [styles.pending]: index > currentStep,
              })}
            >
              {index < currentStep ? (
                <Image
                  src="/images/check.png"
                  alt="完了"
                  width={105}
                  height={87}
                />
              ) : (
                <span className={styles.inner}>{index + 1}</span>
              )}
            </div>
            <div className={styles.stepLabel}>{stepLabels[index]}</div>
          </button>
        );
      })}
      <div
        className={styles.stepLine}
        style={
          { "--progress-width": `${clampedProgress}%` } as React.CSSProperties
        }
      />
    </div>
  );
}
