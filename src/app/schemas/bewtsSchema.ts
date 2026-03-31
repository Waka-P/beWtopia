import { BewtsProjectStatus } from "@/generated/prisma/enums";
import { z } from "zod";

// 役割の定義
const roleSchema = z.object({
  roleId: z.number().int().positive().optional(),
  name: z
    .string()
    .min(1, "役割名を入力してください")
    .max(30, "役割名は30文字以内で入力してください"),
  sharePercentage: z
    .number({ error: "配分率は1以上100以下の整数で入力してください" })
    .int()
    .positive("配分率は正の整数で入力してください")
    .min(1, "配分率は1以上の整数で入力してください")
    .max(100, "配分率は100以下の整数で入力してください"),
});

// フロント用の募集スキーマ
export const bewtsSchema = z
  .object({
    // 基本情報
    name: z
      .string()
      .min(1, "プロジェクト名を入力してください")
      .max(50, "プロジェクト名は50文字以内で入力してください"),

    description: z
      .string()
      .min(1, "プロジェクト概要を入力してください")
      .max(2000, "プロジェクト概要は2000文字以内で入力してください"),

    skills: z
      .array(z.number().int().positive())
      .max(5, "スキルは5個まで選択できます"),

    // 新規スキルの追加は許可しない（Skill は参照テーブルとして管理）

    // 募集設定
    memberCount: z
      .number({ error: "募集人数は1人以上50人以下で入力してください" })
      .int()
      .min(1, "募集人数は1人以上で入力してください")
      .max(50, "募集人数は50人以下で入力してください"),

    durationDays: z
      .number({ error: "開発期間は1日以上365日以内で入力してください" })
      .int()
      .min(1, "開発期間は1日以上で入力してください")
      .max(365, "開発期間は365日以内で入力してください"),

    // 役割・配分設定
    leaderSharePercentage: z
      .number({ error: "リーダー配分率は1以上100以下で入力してください" })
      .int()
      .min(1, "リーダー配分率は1以上で入力してください")
      .max(100, "リーダー配分率は100以下で入力してください"),

    roles: z
      .array(roleSchema)
      .min(1, "リーダー以外の役割を最低1つ追加してください")
      .max(10, "役割は10個まで追加できます"),

    // プロジェクト状態（初期作成時に指定可）
    status: z.enum([
      BewtsProjectStatus.RECRUITING,
      BewtsProjectStatus.DEVELOPING,
      BewtsProjectStatus.COMPLETED,
    ]),
  })
  .superRefine((v, ctx) => {
    // 配分率の合計が100%であることをチェック
    const totalPercentage =
      v.leaderSharePercentage +
      v.roles.reduce((sum, role) => sum + role.sharePercentage, 0);

    if (totalPercentage !== 100) {
      ctx.addIssue({
        code: "custom",
        message: `配分率の合計が100%になるように設定してください（現在: ${totalPercentage}%）`,
        path: [],
      });
    }
  });

export type BewtsFormData = z.infer<typeof bewtsSchema>;
