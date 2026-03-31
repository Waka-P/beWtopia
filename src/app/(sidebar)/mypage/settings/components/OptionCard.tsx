"use client";

import clsx from "clsx";
import { FaChevronRight } from "react-icons/fa6";
import styles from "./OptionCard.module.scss";

type OptionCardProps = {
  label: string;
  description?: string;
  isSelected?: boolean;
  onClick: () => void;
  ariaLabel: string;
  disabled?: boolean;
};

export default function OptionCard({
  label,
  description,
  isSelected = false,
  onClick,
  ariaLabel,
  disabled = false,
}: OptionCardProps) {
  return (
    <button
      type="button"
      className={clsx(
        styles.optionCard,
        isSelected && styles.optionCardSelected,
        disabled && styles.optionCardDisabled,
      )}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      aria-disabled={disabled}
      disabled={disabled}
    >
      <div className={styles.optionHeader}>
        <span className={styles.optionLabel}>{label}</span>
      </div>

      {description && <p className={styles.optionMain}>{description}</p>}

      <div className={styles.rightArrow}>
        <FaChevronRight />
      </div>
    </button>
  );
}
