import {
  ChangeEmail,
  ChangeEmailConfirm,
  ResetPasswordEmail,
  VerifyEmail,
} from "@/components/Emails";
import { genPublicId } from "@/lib/id";
import { prisma } from "@/lib/prisma";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { oneTap } from "better-auth/plugins";
import { hashPassword, verifyPassword } from "./password";
import { sendEmail } from "./resend";

const EMAIL_CHANGE_COMPLETED_NOTICE = "email_change_completed";

function createEmailChangeCompletedCallbackPath(newEmail: string): string {
  return `/mypage/settings?${new URLSearchParams({
    notice: EMAIL_CHANGE_COMPLETED_NOTICE,
    newEmail,
  }).toString()}`;
}

function overrideCallbackURL(url: string, callbackPath: string): string {
  try {
    const parsedUrl = new URL(url);
    parsedUrl.searchParams.set("callbackURL", callbackPath);
    return parsedUrl.toString();
  } catch {
    return url;
  }
}

export const auth = betterAuth({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
  trustedOrigins: ["https://bewtopia.com", "http://localhost:3000"],
  database: prismaAdapter(prisma, {
    provider: "mysql",
  }),
  // ユーザーネームとパスワード認証をONにする
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: 1000 * 60 * 60, // 1時間
    password: {
      hash: hashPassword,
      verify: verifyPassword,
    },
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "パスワードリセットのご案内",
        react: ResetPasswordEmail({
          name: user.name,
          actionUrl: url,
        }),
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }, request) => {
      // サインアップ時とメールアドレス変更時で変える
      const referer = request?.headers.get("referer");
      const isSignUp = referer?.includes("/signup") ?? false;
      const actionUrl = isSignUp
        ? url
        : overrideCallbackURL(
            url,
            createEmailChangeCompletedCallbackPath(user.email),
          );

      if (isSignUp) {
        await sendEmail({
          to: user.email,
          subject: "メールアドレスの確認",
          react: VerifyEmail({
            name: user.name,
            actionUrl,
          }),
        });
      } else {
        await sendEmail({
          to: user.email,
          subject: "メールアドレス変更の確認",
          react: ChangeEmailConfirm({
            name: user.name,
            actionUrl,
          }),
        });
      }
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 1000 * 60 * 60 * 24, // 24時間
  },
  experimental: {
    joins: true,
  },
  user: {
    additionalFields: {
      publicId: {
        type: "string",
        required: true,
        input: false,
        defaultValue: () => genPublicId(),
      },
    },
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        const accounts = await prisma.account.findMany({
          where: { userId: Number(user.id) },
          select: { providerId: true, password: true },
        });

        const hasCredential = accounts.some(
          (account) =>
            !!account.password ||
            account.providerId === "credential" ||
            account.providerId === "email-password",
        );
        const hasAccount = accounts.length > 0;
        const onlyGoogleOrFacebook =
          hasAccount &&
          accounts.every(
            (account) =>
              account.providerId === "google" ||
              account.providerId === "facebook",
          );

        if (!hasCredential && onlyGoogleOrFacebook) {
          throw new APIError("FORBIDDEN", {
            message:
              "SNSログインのみのアカウントでは、メールアドレス変更は利用できません。",
          });
        }

        await sendEmail({
          to: user.email, // Sent to the CURRENT email
          subject: "メールアドレス変更の確認",
          react: ChangeEmail({
            name: user.name,
            newEmail: newEmail,
            actionUrl: url,
          }),
        });
      },
    },
  },
  advanced: {
    database: {
      generateId: "serial",
    },
  },
  // Google oauthを設定する
  socialProviders: {
    google: {
      // アカウントの選択を求める
      prompt: "select_account",
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID as string,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET as string,
    },
  },
  account: {
    accountLinking: {
      enabled: true,
    },
  },
  plugins: [oneTap()],
  onAPIError: {
    errorURL: "/login/error",
  },
});
