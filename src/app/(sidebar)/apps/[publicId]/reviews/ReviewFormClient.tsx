"use client";

import { type ReviewSchema, reviewSchema } from "@/app/schemas/reviewSchema";
import { fetcher } from "@/utils/fetcher";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import styles from "./ReviewFormClient.module.scss";

type InitialValues = { id: number; rating: number; body: string } | null;

type Props = {
  appPublicId: string;
  initialValues?: InitialValues;
};

export default function ReviewFormClient({
  appPublicId,
  initialValues = null,
}: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReviewSchema>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 5, body: "" },
  });

  const currentRating = watch("rating");

  const onSubmit = async (data: ReviewSchema) => {
    setServerError(null);
    try {
      if (initialValues && typeof initialValues.id === "number") {
        await fetcher(`/api/apps/${appPublicId}/reviews/${initialValues.id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });
      } else {
        await fetcher(`/api/apps/${appPublicId}/reviews`, {
          method: "POST",
          body: JSON.stringify(data),
        });
      }
      sessionStorage.setItem(`reviewed:${appPublicId}`, "1");
      window.dispatchEvent(
        new CustomEvent("review:updated", { detail: { appPublicId } }),
      );
      window.dispatchEvent(
        new CustomEvent("review:updated", { detail: { appPublicId } }),
      );
      window.dispatchEvent(
        new CustomEvent("review:updated", { detail: { appPublicId } }),
      );
      router.back();
    } catch (err: any) {
      setServerError(err?.message ?? "レビューの送信に失敗しました");
    }
  };

  useEffect(() => {
    if (!initialValues) return;
    reset({ rating: initialValues.rating, body: initialValues.body });
  }, [initialValues, reset]);

  const activeRating = hoverRating ?? currentRating;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
      {/* 星評価 */}
      <div className={styles.formGroup}>
        <span className={styles.label}>評価</span>
        <div
          className={styles.stars}
          role="radiogroup"
          aria-label="評価"
          onMouseLeave={() => setHoverRating(null)}
        >
          {[1, 2, 3, 4, 5].map((star) => {
            const isActive = star <= activeRating;
            const isHovering = hoverRating !== null;
            return (
              <button
                key={star}
                type="button"
                aria-label={`${star}点`}
                className={[
                  styles.starBtn,
                  isActive
                    ? isHovering
                      ? styles.starHover
                      : styles.starSelected
                    : styles.starIdle,
                ].join(" ")}
                onMouseEnter={() => setHoverRating(star)}
                onClick={() =>
                  setValue("rating", star, { shouldValidate: true })
                }
              >
                ★
              </button>
            );
          })}
        </div>
        {errors.rating && (
          <p className={styles.error}>{errors.rating.message}</p>
        )}
      </div>

      {/* コメント */}
      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="review-body">
          コメント
        </label>
        <textarea
          id="review-body"
          className={styles.textarea}
          rows={6}
          placeholder="このアプリを使ってみて…"
          {...register("body")}
        />
        {errors.body && <p className={styles.error}>{errors.body.message}</p>}
      </div>

      {/* サーバーエラー */}
      {serverError && <p className={styles.error}>{serverError}</p>}

      {/* ボタン */}
      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={isSubmitting}
        >
          {initialValues
            ? isSubmitting
              ? "更新中..."
              : "更新"
            : isSubmitting
              ? "送信中…"
              : "送信"}
        </button>
      </div>
    </form>
  );
}
