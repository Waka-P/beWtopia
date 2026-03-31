import { z } from "zod";

const emailSchema = z.email({
  message: "有効なメールアドレスを入力してください",
});
const passwordSchema = z
  .string()
  .min(8, { message: "パスワードは8文字以上で入力してください" })
  .max(128, { message: "パスワードは128文字以内で入力してください" });
const confirmPasswordSchema = z
  .string()
  .min(1, { message: "確認用パスワードを入力してください" });

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
export const signUpSchema = loginSchema
  .extend({
    name: z
      .string()
      .trim()
      .min(1, { message: "ユーザ名を入力してください" })
      .max(50, { message: "ユーザ名は50文字以内で入力してください" }),
    confirmPassword: confirmPasswordSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "パスワードが一致しません",
    path: ["confirmPassword"],
  });
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: confirmPasswordSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "パスワードが一致しません",
    path: ["confirmPassword"],
  });
export const resendVerificationSchema = z.object({
  email: emailSchema,
});
export type LoginFormData = z.infer<typeof loginSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type ResendVerificationFormData = z.infer<
  typeof resendVerificationSchema
>;
