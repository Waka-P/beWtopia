import type React from "react";
import type { CompositionEvent, FormEvent, InputHTMLAttributes } from "react";

interface NumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  isInteger?: boolean; // 整数のみ
  isPositive?: boolean; // 正の数のみ
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function NumberInput({
  isInteger = true,
  isPositive = true,
  onChange,
  onInput,
  onCompositionEnd,
  ...rest
}: NumberInputProps) {
  // 全角から半角への変換関数
  const normalizeValues = (str: string) => {
    return str
      .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0)) // 全角数字 -> 半角
      .replace(/。/g, ".") // 全角句点 -> ドット
      .replace(/[ー－―ー]/g, "-"); // 各種長音・全角ハイフン -> 半角ハイフン
  };

  const handleProcess = (
    e: FormEvent<HTMLInputElement> | CompositionEvent<HTMLInputElement>,
  ) => {
    const target = e.currentTarget as HTMLInputElement;
    let val = normalizeValues(target.value);

    // モードに応じたフィルタリング
    if (isPositive && isInteger) {
      val = val.replace(/[^0-9]/g, "");
    } else if (isPositive && !isInteger) {
      val = val.replace(/[^0-9.]/g, "");
      const parts = val.split(".");
      if (parts.length > 2) val = parts[0] + "." + parts.slice(1).join("");
    } else if (!isPositive && isInteger) {
      val = val.replace(/[^0-9-]/g, "");
      // マイナスは先頭のみ
      if (val.indexOf("-") > 0 || val.split("-").length > 2) {
        val = (val.startsWith("-") ? "-" : "") + val.replace(/-/g, "");
      }
    } else {
      // 負の数 OK & 小数 OK
      val = val.replace(/[^0-9.-]/g, "");
      // マイナス制御
      const hasMinus = val.startsWith("-");
      val = (hasMinus ? "-" : "") + val.replace(/-/g, "");
      // ドット制御
      const parts = val.split(".");
      if (parts.length > 2) val = parts[0] + "." + parts.slice(1).join("");
    }

    if (target.value !== val) {
      target.value = val;
    }

    // 呼び出し元のイベントを発火
    // FormEvent を ChangeEvent に安全にキャスト
    if (onChange) {
      onChange(e as unknown as React.ChangeEvent<HTMLInputElement>);
    }
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode={isInteger ? "numeric" : "decimal"}
      onInput={handleProcess}
      onCompositionEnd={(e) => {
        handleProcess(e);
        onCompositionEnd?.(e);
      }}
    />
  );
}
