import { z } from "zod";

// ファイルサイズ制限
const MAX_APP_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_IMG_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// 販売形式ごとの価格設定
const salesPlanSchema = z
  .object({
    oneTimeEnabled: z.boolean(),
    oneTimePrice: z.nullable(
      z
        .int({ error: "買い切り価格は1円以上1000万円以下で入力してください" })
        .min(1, "買い切り価格は1円以上で入力してください")
        .max(10000000, "買い切り価格は1000万円以下で入力してください"),
    ),

    monthlyEnabled: z.boolean(),
    monthlyPrice: z.nullable(
      z
        .int({ error: "月額価格は1円以上1000万円以下で入力してください" })
        .min(1, "月額価格は1円以上で入力してください")
        .max(10000000, "月額価格は1000万円以下で入力してください"),
    ),
  })
  .superRefine((v, ctx) => {
    // 最低1つはON
    if (!v.oneTimeEnabled && !v.monthlyEnabled) {
      ctx.addIssue({
        code: "custom",
        message: "販売形式を最低1つ選択してください",
      });
    }

    // 買い切りONなら価格必須
    if (v.oneTimeEnabled) {
      if (v.oneTimePrice == null) {
        ctx.addIssue({
          path: ["oneTimePrice"],
          code: "custom",
          message: "買い切り価格を入力してください",
        });
      }
    }

    // サブスクONなら価格必須
    if (v.monthlyEnabled) {
      if (v.monthlyPrice == null) {
        ctx.addIssue({
          path: ["monthlyPrice"],
          code: "custom",
          message: "月額価格を入力してください",
        });
      }
    }
  });

// 決済方法
const paymentMethodSchema = z
  .object({
    wCoinEnabled: z.boolean(),
    cardEnabled: z.boolean(),
  })
  .refine((v) => v.wCoinEnabled || v.cardEnabled, {
    message: "支払い方法を最低1つ選択してください",
  });

// お試し機能（フロント用 - File型）
export const trialSchemaFrontend = z.discriminatedUnion("trialEnabled", [
  z.object({
    trialEnabled: z.literal(true),
    trialDays: z
      .number({ error: "お試し日数は1日以上30日以内で入力してください" })
      .int()
      .min(1, "お試し日数は1日以上で入力してください")
      .max(30, "お試し日数は30日以内で入力してください"),
    trialFile: z
      .file({ error: "アプリファイルは必須です" })
      .min(1, "アプリファイルは必須です")
      .max(MAX_APP_FILE_SIZE, "アプリファイルは500MB以下にしてください")
      .mime(
        [
          "application/zip",
          "application/x-zip-compressed",
          "application/x-zip",
        ],
        {
          error: "zipファイルのみアップロード可能です",
        },
      ),
  }),
  z.object({
    trialEnabled: z.literal(false),
    trialDays: z.unknown().optional(),
    trialFile: z.unknown().optional(),
  }),
]);

// お試し機能（API用 - URL型）
export const trialSchemaAPI = z.discriminatedUnion("trialEnabled", [
  z.object({
    trialEnabled: z.literal(true),
    trialDays: z.number().int().min(1).max(30),
    trialFileKey: z.string().min(1),
    trialFileSizeBytes: z.number().int().positive(),
  }),
  z.object({
    trialEnabled: z.literal(false),
  }),
]);

// フロント用の出品スキーマ（File型でバリデーション）
export const bewtSchemaFrontend = z.object({
  name: z
    .string()
    .min(1, "アプリ名を入力してください")
    .max(50, "アプリ名は50文字以内で入力してください"),

  summary: z
    .string()
    .min(1, "アプリの概要を入力してください")
    .max(50, "概要は50文字以内で入力してください"),

  description: z.string().min(1, "詳細文を入力してください"),

  tags: z
    .array(z.number().int().positive())
    .max(5, "タグは5個まで選択できます"),

  newTagNames: z
    .array(z.string().min(1).max(50))
    .max(5, "新規タグは5個まで追加できます"),

  images: z
    .array(
      z.object({
        file: z
          .file()
          .max(MAX_IMG_FILE_SIZE, "画像ファイルは5MB以下にしてください")
          .mime(["image/jpeg", "image/png", "image/gif", "image/webp"], {
            error: "jpeg, png, gif, webp形式のみアップロードできます",
          }),
      }),
    )
    .max(5, "アプリの画像は5枚まで登録できます"),

  appFile: z
    .file({ error: "アプリファイルは必須です" })
    .min(1, "アプリファイルは必須です")
    .max(MAX_APP_FILE_SIZE, "アプリファイルは500MB以下にしてください")
    .mime(
      ["application/zip", "application/x-zip-compressed", "application/x-zip"],
      {
        error: "zipファイルのみアップロード可能です",
      },
    ),

  appIcon: z.nullable(
    z
      .file()
      .max(MAX_IMG_FILE_SIZE, "画像ファイルは5MB以下にしてください")
      .mime(["image/jpeg", "image/png", "image/gif", "image/webp"], {
        error: "jpeg, png, gif, webp形式のみアップロードできます",
      }),
  ),

  salesPlan: salesPlanSchema,
  paymentMethod: paymentMethodSchema,
  trial: trialSchemaFrontend,
});

// API用の出品スキーマ（URL型でバリデーション）
export const bewtSchemaAPI = z.object({
  name: z.string().min(1).max(50),
  summary: z.string().min(1).max(50),
  description: z.string().min(1),
  tags: z.array(z.int().positive()).max(5),
  newTagNames: z.array(z.never()).length(0), // API送信時は既にID変換済みなので空配列
  imageUrls: z.array(z.url()).max(5),
  appFileKey: z.string().min(1),
  appFileSizeBytes: z.number().int().positive(),
  appIconUrl: z.url().optional(),
  salesPlan: salesPlanSchema,
  paymentMethod: paymentMethodSchema,
  trial: trialSchemaAPI,
  // ビューズプロジェクトからの共同出品時に、紐付けるための BewtsProject.publicId（任意）
  bewtsProjectPublicId: z.string().length(21).optional(),
});

// 後方互換性のためにエイリアスを残す
export const bewtSchema = bewtSchemaFrontend;
export const trialSchema = trialSchemaFrontend;

export type BewtFormData = z.infer<typeof bewtSchemaFrontend>;
export type BewtAPIData = z.infer<typeof bewtSchemaAPI>;
