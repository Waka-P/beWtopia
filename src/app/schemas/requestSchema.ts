import { z } from "zod";

export const requestSchemaFrontend = z.object({
  title: z
    .string()
    .min(1, "タイトルは必須です")
    .max(100, "タイトルは100文字以内にしてください"),
  content: z
    .string()
    .min(1, "本文は必須です")
    .max(2000, "本文は2000文字以内にしてください"),
  tags: z.array(z.number()).max(5, "タグは5つまでです"),
  newTagNames: z.array(z.string()),
});

export type RequestFormData = z.infer<typeof requestSchemaFrontend>;

// リクエスト作成用のスキーマ（API用）
export const requestSchemaAPI = z.object({
  // keep API limits in sync with frontend: allow up to 100 chars
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(2000),
  tags: z.array(z.number()).max(5),
});
