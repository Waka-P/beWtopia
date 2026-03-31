import { useRef, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import type { BewtFormData } from "@/app/schemas/bewtSchema";
import type { ImageFile } from "../types";
import styles from "./IconUploader.module.scss";
import { cn } from "@/lib/cn";

interface IconUploaderProps {
  id: string;
  onChangeCallback?: () => void;
}

export function IconUploader({ id, onChangeCallback }: IconUploaderProps) {
  const { control } = useFormContext<BewtFormData>();

  return (
    <Controller
      name="appIcon"
      control={control}
      render={({ field }) => (
        <IconUploaderBase
          id={id}
          icon={
            field.value
              ? {
                  src: URL.createObjectURL(field.value),
                  file: field.value,
                }
              : null
          }
          onChange={(icon) => {
            field.onChange(icon?.file || null);
            onChangeCallback?.();
          }}
        />
      )}
    />
  );
}

interface IconUploaderBaseProps {
  icon: ImageFile | null;
  onChange: (icon: ImageFile | null, error: string | false) => void;
  id: string;
}

function IconUploaderBase({ icon, onChange, id }: IconUploaderBaseProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const validateFile = (file: File | null): string | true => {
    if (!file) return "ファイルが選択されていません";

    const allowedExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
    const valid =
      allowedExtensions.some((e) => file.name.toLowerCase().endsWith(e)) &&
      file.type.startsWith("image/");

    if (!valid) {
      return `画像ファイル（${allowedExtensions.join(", ")}）を選択してください`;
    }

    return true;
  };

  const handleFileSelect = (file: File | null) => {
    const validationResult = validateFile(file);
    if (validationResult !== true) {
      onChange(null, validationResult);
      return;
    }

    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        onChange({ file, src: e.target.result as string }, false);
      }
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemove = () => {
    onChange(null, false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className={styles.container}>
      {!icon && (
        // biome-ignore lint: ドラッグ&ドロップをdivで実装
        <div
          className={cn(styles.iconUploadCont, isDragging && styles.dragover)}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          ここにドラッグ＆ドロップ、
          <br />
          またはクリックで画像を追加
          <input
            ref={fileInputRef}
            type="file"
            id={id}
            className={styles.iconFileInput}
            accept="image/*"
            onChange={(e) =>
              handleFileSelect(e.target.files ? e.target.files[0] : null)
            }
          />
        </div>
      )}

      {icon && (
        <div className={styles.iconImgWrapper}>
          <div className={styles.iconPreview}>
            <img src={icon.src} alt="アイコン画像" />
            <button
              className={styles.iconRemoveBtn}
              onClick={handleRemove}
              type="button"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
