"use client";

import type { RequestFormData } from "@/app/schemas/requestSchema";
import { requestSchemaFrontend } from "@/app/schemas/requestSchema";
import { SubmitProgressOverlay } from "@/components/SubmitProgressOverlay";
import { useSubmitProgressOverlay } from "@/components/useSubmitProgressOverlay";
import { cn } from "@/lib/cn";
import { fetcher } from "@/utils/fetcher";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { TagPicker } from "../../../components/TagPicker";
import styles from "./RequestForm.module.scss";

const CONTENT_MAX_LENGTH = 2000;

interface Tag {
  id: number;
  name: string;
}

interface RequestFormProps {
  tags: Tag[];
  initialValues?: RequestFormData;
  requestPublicId?: string;
}

type CreateTagResponse = {
  id?: number;
  tag?: {
    id?: number;
  };
};

export default function RequestForm({
  tags,
  initialValues,
  requestPublicId,
}: RequestFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    isVisible: showSubmitOverlay,
    progress: submitProgress,
    iconSrc: submitIconSrc,
    start: startSubmitOverlay,
    finalize: finalizeSubmitOverlay,
    cancel: closeSubmitOverlay,
  } = useSubmitProgressOverlay();

  const formMethods = useForm<RequestFormData>({
    resolver: zodResolver(requestSchemaFrontend),
    defaultValues: initialValues ?? {
      title: "",
      content: "",
      tags: [],
      newTagNames: [],
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = formMethods;

  const content = watch("content");

  const onSubmit = async (data: RequestFormData) => {
    try {
      setIsSubmitting(true);
      setError(null);
      startSubmitOverlay("/icons/sidebar/request-filled.png");

      // 新規タグを作成
      const newTagIds: number[] = [];
      for (const tagName of data.newTagNames) {
        try {
          const res = await fetcher<CreateTagResponse>("/api/tags", {
            method: "POST",
            body: JSON.stringify({ name: tagName }),
          });

          // /api/tags may return { tag: { id, name } } or { tag } or { id }
          // normalize to numeric id
          let id: number | undefined;
          if (typeof res.id === "number") {
            id = res.id;
          } else if (typeof res.tag?.id === "number") {
            id = res.tag.id;
          }

          if (typeof id === "number") newTagIds.push(id);
        } catch (e) {
          console.error(`タグ作成エラー: ${tagName}`, e);
          // エラーが発生しても続行（元の実装と同じ挙動）
        }
      }

      // リクエストを作成 or 更新
      const allTagIds = [...data.tags, ...newTagIds];
      const request = await fetcher<{ publicId: string }>(
        requestPublicId ? `/api/requests/${requestPublicId}` : "/api/requests",
        {
          method: requestPublicId ? "PATCH" : "POST",
          body: JSON.stringify({
            title: data.title,
            content: data.content,
            tags: allTagIds,
          }),
        },
      );

      await finalizeSubmitOverlay();
      const completeUrl = requestPublicId
        ? `/requests/edit/complete?publicId=${encodeURIComponent(request.publicId)}`
        : `/requests/new/complete?publicId=${encodeURIComponent(request.publicId)}`;
      router.replace(completeUrl);
    } catch (err) {
      console.error("エラー:", err);
      closeSubmitOverlay();
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsSubmitting(false);
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
    <FormProvider {...formMethods}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={handleFormKeyDown}
        className={styles.container}
      >
        <div className={styles.header}>
          <Link href="/requests" className={styles.backLink}>
            <span>◀</span> リクエスト一覧
          </Link>
          <h2>
            {requestPublicId ? "リクエストを編集する" : "リクエストを投稿する"}
          </h2>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <div className={styles.formWrapper}>
          <div className={styles.leftSide}>
            <div className={styles.formGroup}>
              <label htmlFor="title" className={styles.label}>
                タイトル
              </label>
              <input
                id="title"
                type="text"
                placeholder="リクエストのタイトル（50文字まで）"
                className={styles.input}
                {...register("title")}
              />
              {errors.title && (
                <p className={styles.errorMessage}>{errors.title.message}</p>
              )}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="tags" className={styles.label}>
                タグ
              </label>
              <TagPicker<RequestFormData>
                tagsFieldName="tags"
                newTagNamesFieldName="newTagNames"
                tags={tags}
              />
              {errors.tags && (
                <p className={styles.errorMessage}>{errors.tags.message}</p>
              )}
            </div>
          </div>

          <div className={styles.rightSide}>
            <div className={styles.formGroup}>
              <label htmlFor="content" className={styles.label}>
                本文
              </label>
              <textarea
                id="content"
                placeholder="本文を入力..."
                className={styles.textarea}
                {...register("content")}
              />
              <div className={styles.errAndCounter}>
                {errors.content && (
                  <p className={styles.errorMessage}>
                    {errors.content.message}
                  </p>
                )}
                <span
                  className={cn(
                    styles.counter,
                    content.length > CONTENT_MAX_LENGTH && styles.counterError,
                  )}
                >
                  {content.length} / {CONTENT_MAX_LENGTH}
                </span>
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className={styles.submitButton}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? requestPublicId
              ? "更新中..."
              : "投稿中..."
            : requestPublicId
              ? "更新"
              : "投稿"}
        </button>
      </form>
      <SubmitProgressOverlay
        visible={showSubmitOverlay}
        progress={submitProgress}
        iconSrc={submitIconSrc}
        alt="リクエスト送信中アイコン"
        iconSize={80}
      />
    </FormProvider>
  );
}
