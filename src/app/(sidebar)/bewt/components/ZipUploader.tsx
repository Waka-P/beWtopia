import type { BewtFormData } from "@/app/schemas/bewtSchema";
import { cn } from "@/lib/cn";
import { fetcher } from "@/utils/fetcher";
import { useRef, useState } from "react";
import { Controller, type Path, useFormContext } from "react-hook-form";
import styles from "./ZipUploader.module.scss";

interface ZipUploaderProps {
  id: string;
  name: Path<BewtFormData>;
  isLoading?: boolean;
  onChangeCallback?: (fieldName: Path<BewtFormData>) => void;
  // ファイルのローカル/サーバーバリデーション中かどうかを親に通知したい場合
  onValidatingChange?: (isValidating: boolean) => void;
  // お試しZIPなど、アップロード時にサーバー側バリデーションだけ先に行いたい場合のエンドポイント
  validateEndpoint?: string;
  // クライアント側でもサイズ上限をかけたい場合に指定（例: お試しZIP 50MB）
  maxSizeBytes?: number;
  maxSizeErrorMessage?: string;
}

export function ZipUploader({
  id,
  name,
  isLoading = false,
  onChangeCallback,
  onValidatingChange,
  validateEndpoint,
  maxSizeBytes,
  maxSizeErrorMessage,
}: ZipUploaderProps) {
  const { control, setError, clearErrors } = useFormContext<BewtFormData>();

  // nameが指定されていない場合はidから推測
  const fieldName = name;

  return (
    <Controller
      name={fieldName}
      control={control}
      render={({ field }) => (
        <ZipUploaderBase
          id={id}
          file={field.value as File | null}
          isLoading={isLoading}
          maxSizeBytes={maxSizeBytes}
          maxSizeErrorMessage={maxSizeErrorMessage}
          onChange={async (file, localError) => {
            onValidatingChange?.(true);
            try {
              // ローカルバリデーション（拡張子、mimeなど）でエラーがあれば即エラーとして反映
              if (localError) {
                setError(fieldName, {
                  type: "manual",
                  message: localError,
                });
                field.onChange(null);
                return;
              }

              if (!file) {
                setError(fieldName, {
                  type: "manual",
                  message: "ファイルが選択されていません",
                });
                field.onChange(null);
                return;
              }

              // いったんフォーム値を更新 & 既存エラーをクリア
              field.onChange(file);
              clearErrors(fieldName);

              // サーバー側の追加バリデーション（お試しZIPのサイズ/中身チェック）
              if (validateEndpoint) {
                const formData = new FormData();
                formData.append("file", file);

                try {
                  await fetcher(validateEndpoint, {
                    method: "POST",
                    body: formData,
                  });
                } catch (error) {
                  const message =
                    error instanceof Error && error.message
                      ? error.message
                      : "お試しファイルの検証に失敗しました";

                  setError(fieldName, {
                    type: "manual",
                    message,
                  });
                  // サーバー側バリデーションNG時は値もクリアしてアップロード不可にする
                  field.onChange(null);
                  return;
                }
              }

              onChangeCallback?.(fieldName);
            } finally {
              onValidatingChange?.(false);
            }
          }}
        />
      )}
    />
  );
}

interface ZipUploaderBaseProps {
  file: File | null;
  isLoading: boolean;
  onChange: (file: File | null, error: string | false) => void;
  id: string;
  maxSizeBytes?: number;
  maxSizeErrorMessage?: string;
}

function ZipUploaderBase({
  file,
  isLoading,
  onChange,
  id,
  maxSizeBytes,
  maxSizeErrorMessage,
}: ZipUploaderBaseProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const validateFile = (file: File | null): string | true => {
    if (!file) return "ファイルが選択されていません";

    const isValidExtension = file.name.toLowerCase().endsWith(".zip");
    const isValidMimeType =
      file.type === "application/zip" ||
      file.type === "application/x-zip-compressed";

    if (!isValidExtension || !isValidMimeType) {
      return ".zipファイルを選択してください";
    }

    if (typeof maxSizeBytes === "number" && file.size > maxSizeBytes) {
      return (
        maxSizeErrorMessage ||
        "ファイルサイズが大きすぎます。サイズを小さくしてください。"
      );
    }

    return true;
  };

  const handleFileSelect = (selectedFile: File | null) => {
    const validationResult = validateFile(selectedFile);
    if (validationResult !== true) {
      onChange(null, validationResult);
      return;
    }

    onChange(selectedFile, false);

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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
  };

  const truncateFileName = (fileName: string, maxLength: number): string => {
    if (fileName.length <= maxLength) {
      return fileName;
    }

    const extension = fileName.split(".").pop() || "";
    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf("."));
    const maxNameLength = maxLength - extension.length - 4;

    return `${nameWithoutExt.substring(0, maxNameLength)}...${extension}`;
  };

  return (
    <div className={styles.container}>
      {/* upload placeholder when nothing loaded */}
      {!file && !isLoading && (
        // biome-ignore lint: divをクリック可能にするため
        <div
          className={cn(styles.zipUploadCont, isDragging && styles.dragover)}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          ここにドラッグ＆ドロップ、
          <br />
          またはクリックでZIPファイルを追加
          <input
            ref={fileInputRef}
            type="file"
            id={id}
            accept=".zip"
            hidden
            onChange={(e) =>
              handleFileSelect(e.target.files ? e.target.files[0] : null)
            }
          />
        </div>
      )}

      {/* preview or skeleton share same wrapper */}
      {file && !isLoading && (
        <div className={styles.filePreview}>
          <span className={styles.name} title={file.name}>
            {truncateFileName(file.name, 30)}
          </span>
          <span className={styles.size}>{formatFileSize(file.size)}</span>
          <button
            type="button"
            className={styles.remove}
            onClick={handleRemove}
            aria-label="ファイルを削除"
          >
            ×
          </button>
        </div>
      )}

      {isLoading && <div className={styles.filePreviewSkeleton} />}
    </div>
  );
}
