import { z } from "zod";

export const reviewSchema = z.object({
  rating: z
    .number()
    .int("評価は1〜5の正数で入力してください")
    .min(1, "評価は1〜5の間で入力してください")
    .max(5, "評価は1〜5の間で入力してください"),
  body: z.string().max(500, "評価文は500文字以内で入力してください").optional(),
});

export type ReviewSchema = z.infer<typeof reviewSchema>;
