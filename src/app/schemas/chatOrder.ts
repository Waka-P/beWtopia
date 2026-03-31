import { z } from "zod";

export const createChatOrderSchema = z.object({
  title: z
    .string()
    .min(1, "タイトルを入力してください")
    .max(100, "タイトルは100文字以内にしてください"),
  description: z
    .string()
    .min(1, "内容を入力してください")
    .max(2000, "内容は2000文字以内にしてください"),
  price: z
    .number()
    .int("金額は整数で入力してください")
    .positive("金額は1以上で入力してください")
    .max(1_000_000_000, "金額が大きすぎます")
    .nullable()
    .optional(),
  priceUnit: z.enum(["YEN", "W", "BOTH"] as const).default("BOTH"),
  // YYYY-MM-DD 形式想定。API側で Date に変換して検証します。
  deadline: z
    .string()
    .trim()
    .min(1, "期限を正しく入力してください")
    .max(10, "期限を正しく入力してください")
    .nullable()
    .optional(),
});

export type CreateChatOrderInput = z.infer<typeof createChatOrderSchema>;
