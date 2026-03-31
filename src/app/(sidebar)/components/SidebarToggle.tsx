"use client";

import type { ChangeEventHandler, InputHTMLAttributes, ReactNode } from "react";

export type SidebarToggleProps = {
  id: string;
  label?: ReactNode;
  /**
   * 外側コンテナに付与するクラス名（省略時はラッパー div にクラスなし）
   */
  containerClassName?: string;
  /**
   * input 要素用クラス名（例: .toggleInput）
   */
  inputClassName?: string;
  /**
   * トグル本体用クラス名（例: .toggle や .toggle on）
   */
  toggleClassName?: string;
  /**
   * ノブ用クラス名（擬似要素で表現する場合は省略可）
   */
  knobClassName?: string;
  /**
   * 制御コンポーネントとして使うときの checked
   */
  checked?: boolean;
  /**
   * 制御コンポーネントとして使うときの onChange
   */
  onChange?: () => void;
  /**
   * react-hook-form の register から渡す props など
   */
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
};

export function SidebarToggle({
  id,
  label,
  containerClassName,
  inputClassName,
  toggleClassName,
  knobClassName,
  checked,
  onChange,
  inputProps,
}: SidebarToggleProps) {
  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    if (inputProps && typeof inputProps.onChange === "function") {
      inputProps.onChange(event);
    }

    if (typeof onChange === "function") {
      onChange();
    }
  };

  const inputElement = (
    <input
      type="checkbox"
      id={id}
      {...inputProps}
      className={inputClassName}
      checked={checked}
      onChange={handleChange}
    />
  );

  const toggleElement = (
    <label htmlFor={id} className={toggleClassName}>
      {knobClassName ? <span className={knobClassName} /> : null}
    </label>
  );

  if (!containerClassName && !label) {
    // ラベルもコンテナクラスも不要な場合はフラグメントで返す
    return (
      <>
        {inputElement}
        {toggleElement}
      </>
    );
  }

  return (
    <div className={containerClassName}>
      {label ? <label htmlFor={id}>{label}</label> : null}
      {inputElement}
      {toggleElement}
    </div>
  );
}

export default SidebarToggle;
