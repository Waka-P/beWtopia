"use client";

import Avatar from "@/components/Avatar";
import { UserConfirmModal } from "@/components/BlockUserConfirmModal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ErrorModal } from "@/components/ErrorModal";
import NoticeModal from "@/components/NoticeModal";
import { authClient } from "@/lib/auth-client";
import { fetcher } from "@/utils/fetcher";
import { normalizeUserInput } from "@/utils/normalize";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import SidebarToggle from "../../components/SidebarToggle";
import toggleStyles from "../../components/SidebarToggle.module.scss";
import EditorPanel, { type EditorTarget } from "./components/EditorPanel";
import NotificationSettingsPanel, {
  type NotificationSettingItem,
} from "./components/NotificationSettingsPanel";
import OptionCard from "./components/OptionCard";
import PrivacySection, { type PrivacyState } from "./components/PrivacySection";
import TabBar, { type TabType } from "./components/TabBar";
import type { NotificationSettings } from "./notificationSettings";
import styles from "./page.module.scss";

const DEFAULT_PRIVACY_STATE: PrivacyState = {
  follow: true,
  order: true,
  scout: true,
  tip: true,
  showUserList: true,
};

const EMAIL_CHANGE_REQUESTED_NOTICE = "email_change_requested";
const EMAIL_CHANGE_COMPLETED_NOTICE = "email_change_completed";

const GENERAL_NOTIFICATION_ITEMS: NotificationSettingItem[] = [
  {
    key: "followEnabled",
    id: "notif-follow-enabled",
    label: "フォロー通知",
    desc: "誰かがあなたをフォローしたとき",
  },
  {
    key: "bewtEnabled",
    id: "notif-bewt-enabled",
    label: "ビュート通知",
    desc: "フォロー中のユーザがビュートしたとき",
  },
  {
    key: "chatEnabled",
    id: "notif-chat-enabled",
    label: "チャット通知",
    desc: "通常チャットで新しいメッセージやリアクションがあったとき",
  },
  {
    key: "purchaseEnabled",
    id: "notif-purchase-enabled",
    label: "購入通知",
    desc: "あなたのアプリが購入されたとき",
  },
  {
    key: "orderEnabled",
    id: "notif-order-enabled",
    label: "オーダー通知",
    desc: "チャットでオーダーが届いたとき",
  },
  {
    key: "systemEnabled",
    id: "notif-system-enabled",
    label: "システム通知",
    desc: "運営・システムからのお知らせを受け取るとき",
  },
];

const BEWTS_NOTIFICATION_ITEMS: NotificationSettingItem[] = [
  {
    key: "bewtsBewtEnabled",
    id: "notif-bewts-bewt-enabled",
    label: "ビューズ通知",
    desc: "自分が参加しているプロジェクトがビューズされたとき",
  },
  {
    key: "bewtsChatEnabled",
    id: "notif-bewts-chat-enabled",
    label: "ビューズチャット通知",
    desc: "ビューズルームで新しいメッセージやリアクションがあったとき",
  },
  {
    key: "scoutEnabled",
    id: "notif-scout-enabled",
    label: "スカウト通知",
    desc: "ビューズへのスカウトメッセージを受け取ったとき",
  },
  {
    key: "bewtsJoinRequestEnabled",
    id: "notif-bewts-join-request-enabled",
    label: "ビューズ参加申請通知",
    desc: "あなたのビューズに参加申請が届いたとき",
  },
  {
    key: "bewtsJoinApprovedEnabled",
    id: "notif-bewts-join-approved-enabled",
    label: "ビューズ参加承認通知",
    desc: "あなたの参加申請が承認されたとき",
  },
  {
    key: "bewtsJoinDeclinedEnabled",
    id: "notif-bewts-join-declined-enabled",
    label: "ビューズ参加見送り通知",
    desc: "あなたの参加申請が見送りになったとき",
  },
  {
    key: "bewtsJoinFinalizedEnabled",
    id: "notif-bewts-join-finalized-enabled",
    label: "ビューズ参加確定・取消通知",
    desc: "参加メンバー確定や取り消しがあったとき",
  },
];

const BEWTS_NOTIFICATION_KEYS: Array<keyof NotificationSettings> =
  BEWTS_NOTIFICATION_ITEMS.map((item) => item.key);

const GENERAL_NOTIFICATION_KEYS: Array<keyof NotificationSettings> =
  GENERAL_NOTIFICATION_ITEMS.map((item) => item.key);

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

type SettingsClientProps = {
  initialPrivacy: PrivacyState | null;
  initialNotificationSettings: NotificationSettings;
  initialEmail: string | null;
  canManageCredentialSettings: boolean;
  initialCardDescription: string | null;
  initialBlockedUsers: BlockedUser[];
  initialHiddenUsers: HiddenUser[];
  initialHiddenApps: HiddenApp[];
};

export default function SettingsClient({
  initialPrivacy,
  initialNotificationSettings,
  initialEmail,
  canManageCredentialSettings,
  initialCardDescription,
  initialBlockedUsers,
  initialHiddenUsers,
  initialHiddenApps,
}: SettingsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>("basic");
  const [editTarget, setEditTarget] = useState<EditorTarget>("card");
  const [privacy, setPrivacy] = useState<PrivacyState>(
    initialPrivacy ?? DEFAULT_PRIVACY_STATE,
  );
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings>(initialNotificationSettings);
  const registeredEmail = initialEmail ?? "";
  const [nextEmail, setNextEmail] = useState("");
  const [cardDescription, setCardDescription] = useState<string | undefined>(
    initialCardDescription ?? undefined,
  );
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>(
    initialBlockedUsers ?? [],
  );
  const [unblockProcessingIds, setUnblockProcessingIds] = useState<number[]>(
    [],
  );
  const [unblockConfirmUser, setUnblockConfirmUser] =
    useState<BlockedUser | null>(null);
  const [isUnblockProcessing, setIsUnblockProcessing] = useState(false);
  const [hiddenUsers, setHiddenUsers] = useState<HiddenUser[]>(
    initialHiddenUsers ?? [],
  );
  const [hiddenApps, setHiddenApps] = useState<HiddenApp[]>(
    initialHiddenApps ?? [],
  );
  const [unhideUserConfirm, setUnhideUserConfirm] = useState<HiddenUser | null>(
    null,
  );
  const [unhideAppConfirm, setUnhideAppConfirm] = useState<HiddenApp | null>(
    null,
  );
  const [isUnhideUserProcessing, setIsUnhideUserProcessing] = useState(false);
  const [isUnhideAppProcessing, setIsUnhideAppProcessing] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [successNotice, setSuccessNotice] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // クレジットカードのデフォルト支払い方法を取得して表示用文字列を作成
  const loadCardDescription = useCallback(async () => {
    try {
      const data = await fetcher<{
        hasDefault: boolean;
        details?: {
          brand?: string;
          last4?: string;
          expMonth?: number;
          expYear?: number;
        };
      }>("/api/stripe/customer", { method: "GET" });

      if (!data || !data.hasDefault || !data.details) {
        setCardDescription(undefined);
        return;
      }

      const { brand, last4, expMonth, expYear } = data.details;
      const exp =
        expMonth && expYear
          ? `有効期限 ${String(expMonth).padStart(2, "0")}/${String(expYear).slice(-2)}`
          : undefined;

      setCardDescription(
        [brand?.toUpperCase(), last4 && `•••• •••• •••• ${last4}`, exp]
          .filter(Boolean)
          .join("  "),
      );
    } catch (e) {
      console.error("failed to load card description", e);
      setCardDescription(undefined);
    }
  }, []);

  // biome-ignore lint: メールアドレス変更後の確認メール送信完了を知らせるための処理
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (!tab) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "basic");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      setActiveTab("basic");
      setEditTarget("card");
      return;
    }

    if (tab === "basic" || tab === "notifications" || tab === "list") {
      setActiveTab(tab);
      setEditTarget(tab === "basic" ? "card" : null);
    }

    const newEmail = searchParams.get("newEmail")?.trim() ?? "";
    const notice = searchParams.get("notice");

    if (notice === EMAIL_CHANGE_REQUESTED_NOTICE) {
      const normalizedRegisteredEmail = registeredEmail.trim().toLowerCase();
      const normalizedNewEmail = newEmail.toLowerCase();
      const isEmailChangeCompleted =
        !!normalizedNewEmail &&
        normalizedNewEmail === normalizedRegisteredEmail;

      if (isEmailChangeCompleted) {
        showSuccessNotice(
          "メールアドレス変更が完了しました",
          `新しいメールアドレス（${newEmail}）への変更が完了しました。`,
        );
        return;
      }

      if (newEmail) {
        showSuccessNotice(
          "現在のメールアドレスを確認できました",
          `変更後のメールアドレス（${newEmail}）に確認メールが送信されました。\nメール内のリンクをクリックして変更を完了してください。`,
        );
        return;
      }

      showSuccessNotice(
        "現在のメールアドレスを確認できました",
        "変更後のメールアドレスに確認メールが送信されました。\nメール内のリンクをクリックして変更を完了してください。",
      );
      return;
    }

    if (notice === EMAIL_CHANGE_COMPLETED_NOTICE) {
      showSuccessNotice(
        "メールアドレス変更が完了しました",
        newEmail
          ? `新しいメールアドレス（${newEmail}）への変更が完了しました。`
          : "メールアドレスの変更が完了しました。",
      );
    }
  }, [pathname, registeredEmail, router, searchParams]);

  useEffect(() => {
    // サーバーから初期値が来ていない場合のみクライアント側で取得
    if (initialCardDescription === null) {
      void loadCardDescription();
    }
  }, [initialCardDescription, loadCardDescription]);

  const handleToggle = async (key: keyof PrivacyState) => {
    setPrivacy((prev: PrivacyState) => {
      const next = { ...prev, [key]: !prev[key] };
      void fetcher<unknown>("/api/users/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled: next[key] }),
      }).catch((e) => {
        console.error("failed to update privacy", e);
      });
      return next;
    });
  };

  const handleNotificationToggle = async (key: keyof NotificationSettings) => {
    const newValue = !notificationSettings[key];
    setNotificationSettings((prev: NotificationSettings) => ({
      ...prev,
      [key]: newValue,
    }));

    await fetch("/api/notifications/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: newValue }),
    });
  };

  const isBewtsAllEnabled = BEWTS_NOTIFICATION_KEYS.every(
    (key) => notificationSettings[key],
  );

  const isGeneralAllEnabled = GENERAL_NOTIFICATION_KEYS.every(
    (key) => notificationSettings[key],
  );

  const handleGeneralAllToggle = async () => {
    const nextValue = !isGeneralAllEnabled;
    const updateData = GENERAL_NOTIFICATION_KEYS.reduce<
      Partial<NotificationSettings>
    >((acc, key) => {
      acc[key] = nextValue;
      return acc;
    }, {});

    setNotificationSettings((prev: NotificationSettings) => ({
      ...prev,
      ...updateData,
    }));

    await fetch("/api/notifications/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData),
    });
  };

  const handleBewtsAllToggle = async () => {
    const nextValue = !isBewtsAllEnabled;
    const updateData = BEWTS_NOTIFICATION_KEYS.reduce<
      Partial<NotificationSettings>
    >((acc, key) => {
      acc[key] = nextValue;
      return acc;
    }, {});

    setNotificationSettings((prev: NotificationSettings) => ({
      ...prev,
      ...updateData,
    }));

    await fetch("/api/notifications/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData),
    });
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);

    if (tab === "basic") {
      setEditTarget("card");
    } else {
      setEditTarget(null);
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (canManageCredentialSettings) return;
    if (editTarget === "email" || editTarget === "password") {
      setEditTarget(null);
    }
  }, [canManageCredentialSettings, editTarget]);

  const onCancel = () => setEditTarget(null);

  const showErrorModal = (message: string) => {
    setErrorMessage(message);
  };

  const showSuccessNotice = (title: string, message: string) => {
    setSuccessNotice({ title, message });
  };

  const getAuthErrorMessage = (
    error: unknown,
    fallbackMessage: string,
  ): string => {
    if (!error) return fallbackMessage;
    if (typeof error === "string") return error;

    if (typeof error === "object") {
      const maybeError = error as {
        message?: unknown;
      };

      if (typeof maybeError.message === "string") {
        return maybeError.message;
      }
    }

    return fallbackMessage;
  };

  const handleEmailSave = async (nextEmail: string) => {
    if (!canManageCredentialSettings) {
      showErrorModal(
        "SNSログインのみのアカウントでは、メールアドレス変更は利用できません。",
      );
      return;
    }

    if (isSavingEmail) return;

    const normalizedEmail = normalizeUserInput(nextEmail);
    if (!normalizedEmail) {
      showErrorModal("メールアドレスを入力してください。");
      return;
    }

    if (normalizedEmail === registeredEmail.trim()) {
      showErrorModal("現在と同じメールアドレスは設定できません。");
      return;
    }

    setIsSavingEmail(true);
    try {
      const callbackPath = `/mypage/settings?${new URLSearchParams({
        notice: EMAIL_CHANGE_REQUESTED_NOTICE,
        newEmail: normalizedEmail,
      }).toString()}`;

      const { error } = await authClient.changeEmail({
        newEmail: normalizedEmail,
        callbackURL: callbackPath,
      });

      if (error) {
        showErrorModal(
          getAuthErrorMessage(
            error,
            "メールアドレス変更の処理に失敗しました。もう一度お試しください。",
          ),
        );
        return;
      }

      setNextEmail("");
      setEditTarget(null);
      showSuccessNotice(
        "メールアドレス変更の確認を開始しました",
        `現在のメールアドレス（${registeredEmail}）で変更を承認してください。`,
      );
    } catch (error) {
      console.error("failed to change email", error);
      showErrorModal(
        "メールアドレス変更の処理に失敗しました。もう一度お試しください。",
      );
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handlePasswordSave = async ({
    currentPassword,
    newPassword,
    confirmPassword,
  }: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    if (!canManageCredentialSettings) {
      showErrorModal(
        "SNSログインのみのアカウントでは、パスワード変更は利用できません。",
      );
      return;
    }

    if (isSavingPassword) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      showErrorModal("パスワードをすべて入力してください。");
      return;
    }

    if (newPassword !== confirmPassword) {
      showErrorModal("新しいパスワードと確認用パスワードが一致しません。");
      return;
    }

    setIsSavingPassword(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword: normalizeUserInput(currentPassword),
        newPassword: normalizeUserInput(newPassword),
        revokeOtherSessions: true,
      });

      if (error) {
        showErrorModal(
          getAuthErrorMessage(
            error,
            "パスワード変更に失敗しました。入力内容をご確認ください。",
          ),
        );
        return;
      }

      setEditTarget(null);
      showSuccessNotice(
        "パスワードを変更しました",
        "パスワードの更新が完了しました。次回以降は新しいパスワードでログインしてください。",
      );
    } catch (error) {
      console.error("failed to change password", error);
      showErrorModal(
        "パスワード変更に失敗しました。入力内容をご確認のうえ、再度お試しください。",
      );
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleAccountDelete = () => {
    setDeleteConfirmOpen(true);
  };

  const openUnblockConfirm = (user: BlockedUser) => {
    setUnblockConfirmUser(user);
  };

  const handleUnblock = async (userId: number) => {
    setUnblockProcessingIds((prev: number[]) =>
      prev.includes(userId) ? prev : [...prev, userId],
    );

    try {
      await fetcher<unknown>(`/api/users/${userId}/block`, {
        method: "DELETE",
      });

      setBlockedUsers((prev: BlockedUser[]) =>
        prev.filter((user: BlockedUser) => user.id !== userId),
      );
    } catch (e) {
      console.error("failed to unblock user", e);
    } finally {
      setUnblockProcessingIds((prev: number[]) =>
        prev.filter((id: number) => id !== userId),
      );
    }
  };

  const handleUnblockConfirm = async () => {
    if (!unblockConfirmUser || isUnblockProcessing) return;
    setIsUnblockProcessing(true);
    await handleUnblock(unblockConfirmUser.id);
    setIsUnblockProcessing(false);
    setUnblockConfirmUser(null);
  };

  const handleUnblockCancel = () => {
    if (isUnblockProcessing) return;
    setUnblockConfirmUser(null);
  };

  const handleUnhideUserConfirm = async () => {
    if (!unhideUserConfirm || isUnhideUserProcessing) return;

    setIsUnhideUserProcessing(true);
    try {
      await fetcher<unknown>(`/api/users/${unhideUserConfirm.id}/hidden`, {
        method: "DELETE",
      });

      setHiddenUsers((prev: HiddenUser[]) =>
        prev.filter((user: HiddenUser) => user.id !== unhideUserConfirm.id),
      );
    } catch (e) {
      console.error("failed to unhide user", e);
    } finally {
      setIsUnhideUserProcessing(false);
      setUnhideUserConfirm(null);
    }
  };

  const handleUnhideUserCancel = () => {
    if (isUnhideUserProcessing) return;
    setUnhideUserConfirm(null);
  };

  const handleUnhideAppConfirm = async () => {
    if (!unhideAppConfirm || isUnhideAppProcessing) return;

    setIsUnhideAppProcessing(true);
    try {
      await fetcher<unknown>(`/api/apps/${unhideAppConfirm.publicId}/hidden`, {
        method: "DELETE",
      });

      setHiddenApps((prev: HiddenApp[]) =>
        prev.filter(
          (app: HiddenApp) => app.publicId !== unhideAppConfirm.publicId,
        ),
      );
    } catch (e) {
      console.error("failed to unhide app", e);
    } finally {
      setIsUnhideAppProcessing(false);
      setUnhideAppConfirm(null);
    }
  };

  const handleUnhideAppCancel = () => {
    if (isUnhideAppProcessing) return;
    setUnhideAppConfirm(null);
  };

  return (
    <div className={styles.page}>
      <TabBar activeTab={activeTab} onTabChange={handleTabChange} />

      <div className={styles.grid}>
        <div className={styles.left}>
          {activeTab === "basic" && (
            <div className={styles.sections}>
              <div className={styles.section}>
                <div className={styles.sectionTitle}>支払設定</div>

                <OptionCard
                  label="クレジットカード"
                  description={cardDescription}
                  isSelected={editTarget === "card"}
                  onClick={() => setEditTarget("card")}
                  ariaLabel="クレジットカード情報"
                />
              </div>

              <div className={styles.section}>
                <div className={styles.sectionTitle}>セキュリティ設定</div>

                <div className={styles.securityOptions}>
                  <OptionCard
                    label="パスワード変更"
                    isSelected={editTarget === "password"}
                    onClick={() => setEditTarget("password")}
                    ariaLabel="パスワード変更"
                    disabled={!canManageCredentialSettings}
                  />

                  <OptionCard
                    label="メールアドレス変更"
                    description={registeredEmail}
                    isSelected={editTarget === "email"}
                    onClick={() => setEditTarget("email")}
                    ariaLabel="メールアドレス変更"
                    disabled={!canManageCredentialSettings}
                  />

                  {!canManageCredentialSettings && (
                    <p className={styles.securityHint}>
                      Google/Facebookログインのみをご利用のため、メールアドレス・パスワード変更は利用できません。
                    </p>
                  )}
                </div>
              </div>

              <div className={styles.section}>
                <div className={styles.sectionTitle}>プライバシー設定</div>

                <PrivacySection privacy={privacy} onToggle={handleToggle} />
              </div>

              <div className={styles.section}>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={handleAccountDelete}
                >
                  アカウント削除
                </button>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className={styles.notificationGroup}>
              <div className={styles.notificationGroupHeader}>
                <h3 className={styles.notificationGroupTitle}>一般通知</h3>
                <div className={styles.notificationGroupAll}>
                  <span className={styles.notificationGroupAllLabel}>
                    すべて
                  </span>
                  <SidebarToggle
                    id="notif-general-all-enabled"
                    checked={isGeneralAllEnabled}
                    onChange={() => void handleGeneralAllToggle()}
                    inputClassName={toggleStyles.toggleInput}
                    toggleClassName={toggleStyles.toggle}
                    knobClassName={toggleStyles.knob}
                  />
                </div>
              </div>
              <NotificationSettingsPanel
                settings={notificationSettings}
                onToggle={(key) => void handleNotificationToggle(key)}
                items={GENERAL_NOTIFICATION_ITEMS}
              />
            </div>
          )}

          {activeTab === "list" && (
            <div className={styles.sections}>
              <div className={styles.section}>
                <div className={styles.sectionTitle}>ブロックリスト</div>

                <div className={styles.blockList}>
                  {blockedUsers.length === 0 ? (
                    <div className={styles.placeholder}>
                      ブロックしているユーザはいません。
                    </div>
                  ) : (
                    <ul className={styles.blockListItems}>
                      {blockedUsers.map((user: BlockedUser) => (
                        <li key={user.id} className={styles.blockListItem}>
                          <Link
                            href={`/users/${user.publicId}`}
                            className={styles.blockUserLink}
                          >
                            <Avatar
                              src={user.image}
                              alt={`${user.name}さんのアイコン`}
                              className={styles.blockUserAvatar}
                            />
                            <span className={styles.blockUserName}>
                              {user.name}
                            </span>
                          </Link>

                          <button
                            type="button"
                            className={styles.unblockBtn}
                            onClick={() => openUnblockConfirm(user)}
                            disabled={unblockProcessingIds.includes(user.id)}
                          >
                            ブロック解除
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className={styles.section}>
                <div className={styles.sectionTitle}>非表示リスト</div>
                <div className={styles.blockList}>
                  <div className={styles.sectionSubtitle}>ユーザ</div>
                  {hiddenUsers.length === 0 ? (
                    <div className={styles.placeholder}>
                      非表示にしているユーザはまだいません。
                    </div>
                  ) : (
                    <ul className={styles.blockListItems}>
                      {hiddenUsers.map((user: HiddenUser) => (
                        <li key={user.id} className={styles.blockListItem}>
                          <Link
                            href={`/users/${user.publicId}`}
                            className={styles.blockUserLink}
                          >
                            <Avatar
                              src={user.image}
                              alt={`${user.name}さんのアイコン`}
                              className={styles.blockUserAvatar}
                            />
                            <span className={styles.blockUserName}>
                              {user.name}
                            </span>
                          </Link>

                          <button
                            type="button"
                            className={styles.unblockBtn}
                            onClick={() => setUnhideUserConfirm(user)}
                          >
                            再表示
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className={styles.sectionSubtitle}>アプリ</div>
                  {hiddenApps.length === 0 ? (
                    <div className={styles.placeholder}>
                      非表示にしているアプリはまだありません。
                    </div>
                  ) : (
                    <ul className={styles.blockListItems}>
                      {hiddenApps.map((app: HiddenApp) => (
                        <li key={app.id} className={styles.blockListItem}>
                          <Link
                            href={`/apps/${app.publicId}`}
                            className={styles.blockUserLink}
                          >
                            <Avatar
                              src={app.iconUrl}
                              alt={`${app.name}のアイコン`}
                              className={styles.blockUserAvatar}
                            />
                            <span className={styles.blockUserName}>
                              {app.name}
                            </span>
                          </Link>

                          <button
                            type="button"
                            className={styles.unblockBtn}
                            onClick={() => setUnhideAppConfirm(app)}
                          >
                            再表示
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.right}>
          {activeTab === "basic" && (
            <EditorPanel
              key={editTarget ?? "email"}
              editTarget={editTarget}
              registeredEmail={registeredEmail}
              nextEmail={nextEmail}
              onNextEmailChange={setNextEmail}
              onSaveEmail={handleEmailSave}
              onSavePassword={handlePasswordSave}
              onCancel={onCancel}
              isSavingEmail={isSavingEmail}
              isSavingPassword={isSavingPassword}
              onCardSaved={() => {
                void loadCardDescription();
              }}
            />
          )}

          {activeTab === "notifications" && (
            <div className={styles.notificationGroup}>
              <div className={styles.notificationGroupHeader}>
                <h3 className={styles.notificationGroupTitle}>ビューズ通知</h3>
                <div className={styles.notificationGroupAll}>
                  <span className={styles.notificationGroupAllLabel}>
                    すべて
                  </span>
                  <SidebarToggle
                    id="notif-bewts-all-enabled"
                    checked={isBewtsAllEnabled}
                    onChange={() => void handleBewtsAllToggle()}
                    inputClassName={toggleStyles.toggleInput}
                    toggleClassName={toggleStyles.toggle}
                    knobClassName={toggleStyles.knob}
                  />
                </div>
              </div>

              <NotificationSettingsPanel
                settings={notificationSettings}
                onToggle={(key) => void handleNotificationToggle(key)}
                items={BEWTS_NOTIFICATION_ITEMS}
              />
            </div>
          )}
        </div>
      </div>
      <NoticeModal
        isOpen={!!successNotice}
        onClose={() => setSuccessNotice(null)}
        classNames={{ content: styles.completeNoticeContent }}
      >
        <Image
          src="/images/exclamation-primary.png"
          width={114}
          height={114}
          alt="完了"
          className={styles.completeNoticeIcon}
        />
        <h2 className={styles.completeNoticeTitle}>{successNotice?.title}</h2>
        <p className={styles.completeNoticeMessage}>{successNotice?.message}</p>
        <button
          type="button"
          className={styles.completeNoticeCloseBtn}
          onClick={() => setSuccessNotice(null)}
        >
          閉じる
        </button>
      </NoticeModal>
      <ErrorModal
        open={!!errorMessage}
        title="設定変更エラー"
        message={errorMessage ?? ""}
        onClose={() => setErrorMessage(null)}
      />
      {/* アカウント削除確認モーダル */}
      <ConfirmModal
        open={isDeleteConfirmOpen}
        title="アカウント削除"
        message="本当にアカウントを削除しますか？この操作は取り消せません。"
        confirmLabel="削除する"
        cancelLabel="キャンセル"
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          // TODO: アカウント削除API呼び出し
          console.log("account delete requested");
          setDeleteConfirmOpen(false);
        }}
      />
      {/* ブロック解除確認モーダル */}
      <UserConfirmModal
        open={!!unblockConfirmUser}
        onOpenChange={(open) => {
          if (!open) {
            handleUnblockCancel();
          }
        }}
        title="このユーザのブロックを解除しますか？"
        description="このユーザのブロックを解除しますか？"
        userName={unblockConfirmUser?.name ?? ""}
        userImage={unblockConfirmUser?.image ?? null}
        confirmLabel="ブロック解除"
        cancelLabel="キャンセル"
        variant="unblock"
        processing={isUnblockProcessing}
        onConfirm={handleUnblockConfirm}
      />
      {/* 非表示ユーザ再表示確認モーダル */}
      <ConfirmModal
        open={!!unhideUserConfirm}
        title="このユーザを再表示しますか？"
        message="非表示を解除すると、このユーザは再び一覧や検索に表示されます。"
        appName={unhideUserConfirm?.name}
        confirmLabel="再表示する"
        cancelLabel="キャンセル"
        onConfirm={handleUnhideUserConfirm}
        onCancel={handleUnhideUserCancel}
      />
      {/* 非表示アプリ再表示確認モーダル */}
      <ConfirmModal
        open={!!unhideAppConfirm}
        title="このアプリを再表示しますか？"
        message="非表示を解除すると、このアプリは再びトップや検索結果、購入一覧に表示されます。"
        appName={unhideAppConfirm?.name}
        confirmLabel="再表示する"
        cancelLabel="キャンセル"
        onConfirm={handleUnhideAppConfirm}
        onCancel={handleUnhideAppCancel}
      />
    </div>
  );
}
