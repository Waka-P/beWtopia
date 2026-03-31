import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { headers } from "next/headers";
import type { PrivacyState } from "./components/PrivacySection";
import type { NotificationSettings } from "./notificationSettings";
import SettingsClient from "./SettingsClient";

export const metadata: Metadata = {
  title: "マイページ - 設定",
};

type InitialSettingsData = {
  privacy: PrivacyState | null;
  notificationSettings: NotificationSettings;
  email: string | null;
  canManageCredentialSettings: boolean;
  cardDescription: string | null;
  blockedUsers: BlockedUser[];
  hiddenUsers: HiddenUser[];
  hiddenApps: HiddenApp[];
};

type BlockedUser = {
  id: number;
  publicId: string;
  name: string;
  image: string | null;
};

type HiddenUser = {
  id: number;
  publicId: string;
  name: string;
  image: string | null;
};

type HiddenApp = {
  id: number;
  publicId: string;
  name: string;
  iconUrl: string | null;
};

async function getInitialSettingsData(): Promise<InitialSettingsData> {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });

  const email = session?.user?.email ?? null;
  let canManageCredentialSettings = true;
  const cookie = h.get("cookie") ?? undefined;

  try {
    if (session?.user?.id) {
      const userId = Number(session.user.id);
      if (Number.isInteger(userId) && userId > 0) {
        const accounts = await prisma.account.findMany({
          where: { userId },
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
          canManageCredentialSettings = false;
        }
      }
    }
  } catch {
    canManageCredentialSettings = true;
  }

  let privacy: PrivacyState | null = null;
  try {
    if (session?.user?.id) {
      const userId = Number(session.user.id);

      if (Number.isInteger(userId) && userId > 0) {
        // /api/users/privacy の GET と同等のロジックをサーバーコンポーネント側に直接実装
        const categories = await prisma.privacyCategory.findMany({});
        const settings = await prisma.privacySetting.findMany({
          where: { userId },
        });

        const state: PrivacyState = {
          follow: true,
          order: true,
          scout: true,
          tip: true,
          showUserList: true,
        };

        const NAME_TO_KEY: Record<string, keyof PrivacyState> = {
          フォロー: "follow",
          オーダー: "order",
          スカウト: "scout",
          投げ銭: "tip",
          ユーザ一覧への表示: "showUserList",
        };

        for (const cat of categories) {
          const key = NAME_TO_KEY[cat.name];
          if (!key) continue;
          const setting = settings.find((s) => s.privacyCategoryId === cat.id);
          if (setting) {
            state[key] = setting.isEnabled;
          }
        }

        privacy = state;
      }
    }
  } catch {
    // 初期値はクライアント側のデフォルトを使用
    privacy = null;
  }

  const notificationSettings: NotificationSettings = {
    followEnabled: true,
    bewtEnabled: true,
    bewtsBewtEnabled: true,
    purchaseEnabled: true,
    chatEnabled: true,
    bewtsChatEnabled: true,
    orderEnabled: true,
    scoutEnabled: true,
    bewtsJoinRequestEnabled: true,
    bewtsJoinApprovedEnabled: true,
    bewtsJoinDeclinedEnabled: true,
    bewtsJoinFinalizedEnabled: true,
    bewtsJoinEnabled: true,
    systemEnabled: true,
  };

  try {
    if (session?.user?.id) {
      const userId = Number(session.user.id);

      if (Number.isInteger(userId) && userId > 0) {
        let settings = await prisma.notificationSetting.findUnique({
          where: { userId },
        });

        if (!settings) {
          settings = await prisma.notificationSetting.create({
            data: { userId },
          });
        }

        notificationSettings.followEnabled = settings.followEnabled;
        notificationSettings.bewtEnabled = settings.bewtEnabled;
        notificationSettings.bewtsBewtEnabled = settings.bewtsBewtEnabled;
        notificationSettings.purchaseEnabled = settings.purchaseEnabled;
        notificationSettings.chatEnabled = settings.chatEnabled;
        notificationSettings.bewtsChatEnabled = settings.bewtsChatEnabled;
        notificationSettings.orderEnabled = settings.orderEnabled;
        notificationSettings.scoutEnabled = settings.scoutEnabled;
        notificationSettings.bewtsJoinRequestEnabled =
          settings.bewtsJoinRequestEnabled;
        notificationSettings.bewtsJoinApprovedEnabled =
          settings.bewtsJoinApprovedEnabled;
        notificationSettings.bewtsJoinDeclinedEnabled =
          settings.bewtsJoinDeclinedEnabled;
        notificationSettings.bewtsJoinFinalizedEnabled =
          settings.bewtsJoinFinalizedEnabled;
        notificationSettings.bewtsJoinEnabled = settings.bewtsJoinEnabled;
        notificationSettings.systemEnabled = settings.systemEnabled;
      }
    }
  } catch {
    // 初期値はデフォルトを使用
  }

  let blockedUsers: BlockedUser[] = [];
  let hiddenUsers: HiddenUser[] = [];
  let hiddenApps: HiddenApp[] = [];
  try {
    if (session?.user?.id) {
      const userId = Number(session.user.id);

      if (Number.isInteger(userId) && userId > 0) {
        // 自分がブロックしているユーザを User 側から取得
        const users = await prisma.user.findMany({
          where: {
            blockedByUsers: {
              some: {
                blockerId: userId,
              },
            },
          },
          select: {
            id: true,
            publicId: true,
            name: true,
            image: true,
          },
          orderBy: { id: "asc" },
        });

        blockedUsers = users.map((u) => ({
          id: u.id,
          publicId: u.publicId,
          name: u.name,
          image: u.image,
        }));

        // 自分が非表示にしているユーザ
        const hiddenUserRows = await prisma.user.findMany({
          where: {
            hiddenByUsers: {
              some: {
                userId,
              },
            },
          },
          select: {
            id: true,
            publicId: true,
            name: true,
            image: true,
          },
          orderBy: { id: "asc" },
        });

        hiddenUsers = hiddenUserRows.map((u) => ({
          id: u.id,
          publicId: u.publicId,
          name: u.name,
          image: u.image,
        }));

        // 自分が非表示にしているアプリ
        const hiddenAppRows = await prisma.app.findMany({
          where: {
            hiddenByUsers: {
              some: {
                userId,
              },
            },
          },
          select: {
            id: true,
            publicId: true,
            name: true,
            appIconUrl: true,
          },
          orderBy: { id: "asc" },
        });

        hiddenApps = hiddenAppRows.map((a) => ({
          id: a.id,
          publicId: a.publicId,
          name: a.name,
          iconUrl: a.appIconUrl,
        }));
      }
    }
  } catch {
    blockedUsers = [];
    hiddenUsers = [];
    hiddenApps = [];
  }

  let cardDescription: string | null = null;
  try {
    const init: RequestInit = { cache: "no-store" };
    if (cookie) {
      init.headers = { cookie };
    }
    const res = await fetch("/api/stripe/customer", init);
    if (res.ok) {
      const data = (await res.json()) as {
        hasDefault: boolean;
        details?: {
          brand?: string;
          last4?: string;
          expMonth?: number;
          expYear?: number;
        };
      };

      if (data.hasDefault && data.details) {
        const { brand, last4, expMonth, expYear } = data.details;
        const exp =
          expMonth && expYear
            ? `有効期限 ${String(expMonth).padStart(2, "0")}/${String(expYear).slice(-2)}`
            : undefined;

        cardDescription = [
          brand?.toUpperCase(),
          last4 && `•••• •••• •••• ${last4}`,
          exp,
        ]
          .filter(Boolean)
          .join("  ");
      }
    }
  } catch {
    cardDescription = null;
  }

  return {
    privacy,
    notificationSettings,
    email,
    canManageCredentialSettings,
    cardDescription,
    blockedUsers,
    hiddenUsers,
    hiddenApps,
  };
}

export default async function SettingsPage() {
  const initialData = await getInitialSettingsData();

  return (
    <SettingsClient
      initialPrivacy={initialData.privacy}
      initialNotificationSettings={initialData.notificationSettings}
      initialEmail={initialData.email}
      canManageCredentialSettings={initialData.canManageCredentialSettings}
      initialCardDescription={initialData.cardDescription}
      initialBlockedUsers={initialData.blockedUsers}
      initialHiddenUsers={initialData.hiddenUsers}
      initialHiddenApps={initialData.hiddenApps}
    />
  );
}
