"use client";

import { BewtsCapabilityPicker } from "@/app/(sidebar)/components/BewtsCapabilityPicker";
import { RolePicker } from "@/app/(sidebar)/components/RolePicker";
import SidebarToggle from "@/app/(sidebar)/components/SidebarToggle";
import toggleStyles from "@/app/(sidebar)/components/SidebarToggle.module.scss";
import { useTabIndicator } from "@/app/(sidebar)/components/useTabIndicator";
import { UserConfirmModal } from "@/components/BlockUserConfirmModal";
import { ErrorModal } from "@/components/ErrorModal";
import type { BewtsCapability } from "@/generated/prisma/enums";
import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import NotificationHistoryItem from "./components/NotificationHistoryItem";
import styles from "./Notifications.module.scss";
import type {
  ConfirmNotificationState,
  NotificationItem,
  NotificationSettings,
} from "./types";

type Props = {
  notifications: NotificationItem[];
  initialNotificationSettings: NotificationSettings;
};

type NotificationTabType = "history" | "settings";

type SimpleNotificationSettingItem = {
  keys: Array<keyof NotificationSettings>;
  id: string;
  label: string;
  desc: string;
};

const SIMPLE_NOTIFICATION_ITEMS: SimpleNotificationSettingItem[] = [
  {
    keys: ["followEnabled"],
    id: "notifs-page-follow-enabled",
    label: "フォロー通知",
    desc: "誰かがあなたをフォローしたとき",
  },
  {
    keys: ["bewtEnabled"],
    id: "notifs-page-bewt-enabled",
    label: "ビュート通知",
    desc: "フォロー中のユーザがビュートしたとき",
  },
  {
    keys: ["chatEnabled"],
    id: "notifs-page-chat-enabled",
    label: "チャット通知",
    desc: "通常チャットで新しいメッセージやリアクションがあったとき",
  },
  {
    keys: ["bewtsBewtEnabled"],
    id: "notifs-page-bewts-bewt-enabled",
    label: "ビューズ通知",
    desc: "自分が参加しているプロジェクトがビューズされたとき",
  },
  {
    keys: ["bewtsChatEnabled"],
    id: "notifs-page-bewts-chat-enabled",
    label: "ビューズチャット通知",
    desc: "ビューズルームで新しいメッセージやリアクションがあったとき",
  },
  {
    keys: ["bewtsJoinRequestEnabled", "bewtsJoinFinalizedEnabled"],
    id: "notifs-page-bewts-join-flow-enabled",
    label: "ビューズ参加申請・参加確定・取消通知",
    desc: "参加申請の到着と、参加確定・取り消しをまとめて受け取るとき",
  },
  {
    keys: ["systemEnabled"],
    id: "notifs-page-system-enabled",
    label: "システム通知",
    desc: "運営・システムからのお知らせを受け取るとき",
  },
];

const SIMPLE_NOTIFICATION_KEYS: Array<keyof NotificationSettings> = [
  ...new Set(SIMPLE_NOTIFICATION_ITEMS.flatMap((item) => item.keys)),
];

export default function NotificationsClient({
  notifications,
  initialNotificationSettings,
}: Props) {
  const [activeTab, setActiveTab] = useState<NotificationTabType>("history");
  const { tabbedRef, indicatorRef } =
    useTabIndicator<NotificationTabType>(activeTab);
  const [following, setFollowing] = useState<Record<number, boolean>>({});
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings>(initialNotificationSettings);

  // make a local copy so we can reflect immediate state changes (approve/decline -> show 確定待ち + 元に戻す)
  const [localNotifications, setLocalNotifications] = useState(notifications);

  const router = useRouter();

  // 承認／見送りの確認モーダル用 state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmNotif, setConfirmNotif] =
    useState<ConfirmNotificationState | null>(null);
  // モーダル内で表示するプロジェクトの role 一覧（admin のみ使用）
  const [confirmNotifRoles, setConfirmNotifRoles] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const [confirmProcessing, setConfirmProcessing] = useState(false);

  const [errorModal, setErrorModal] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const isAllEnabled = SIMPLE_NOTIFICATION_KEYS.every(
    (key) => notificationSettings[key],
  );

  // 通知の未読件数を Sidebar にリアルタイム連携（未読バッジ更新用）
  useEffect(() => {
    if (typeof window === "undefined") return;

    const unreadCount = localNotifications.filter((n) => !n.isRead).length;

    window.dispatchEvent(
      new CustomEvent("notifications:unread-count-changed", {
        detail: { unreadCount },
      }),
    );
  }, [localNotifications]);

  const formatTimeAgo = (isoDate: string) => {
    const now = new Date();
    const date = new Date(isoDate);
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}分前`;
    if (hours < 24) return `${hours}時間前`;
    if (days < 30) return `${days}日前`;

    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const toggleFollow = async (notifId: number, actorId: number) => {
    const isFollowing = following[notifId];
    setFollowing({ ...following, [notifId]: !isFollowing });

    // API呼び出し
    await fetch(`/api/users/${actorId}/follow`, {
      method: isFollowing ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
    });
  };

  const markAsRead = async (notifId: number) => {
    const res = await fetch(`/api/notifications/${notifId}/read`, {
      method: "PATCH",
    });

    if (!res.ok) {
      // サーバー側更新に失敗した場合はローカル状態を変えずに終了
      return;
    }

    setLocalNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n)),
    );

    // レイアウトを再評価してサイドバーの未読数バッジも更新
    router.refresh();
  };

  const handleNotificationItemToggle = async (
    keys: Array<keyof NotificationSettings>,
  ) => {
    const currentEnabled = keys.every((key) => notificationSettings[key]);
    const nextValue = !currentEnabled;

    const updateData = keys.reduce<Partial<NotificationSettings>>(
      (acc, key) => {
        acc[key] = nextValue;
        return acc;
      },
      {},
    );

    setNotificationSettings((prev) => ({
      ...prev,
      ...updateData,
    }));

    await fetch("/api/notifications/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData),
    });
  };

  const handleAllToggle = async () => {
    const nextValue = !isAllEnabled;
    const updateData = SIMPLE_NOTIFICATION_KEYS.reduce<
      Partial<NotificationSettings>
    >((acc, key) => {
      acc[key] = nextValue;
      return acc;
    }, {});

    setNotificationSettings((prev) => ({
      ...prev,
      ...updateData,
    }));

    await fetch("/api/notifications/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData),
    });
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      await markAsRead(notif.id);
    }

    // スカウト通知はチャットの該当メッセージまで遷移＆スク役割
    if (notif.type === "SCOUT" && notif.actor && notif.bewtsJoinRequest) {
      try {
        const res = await fetch("/api/chat/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId: notif.actor.publicId }),
        });

        if (!res.ok) {
          return;
        }

        const room = await res.json().catch(() => null);
        if (!room || !room.publicId) return;

        router.push(
          `/chat/${room.publicId}?scoutRequestId=${notif.bewtsJoinRequest.id}`,
        );
        return;
      } catch {
        // noop
      }
    }

    if (notif.redirectUrl) {
      router.push(notif.redirectUrl);
    }
  };

  const handleJoinRequestAction = async (
    requestId: number,
    action: "approve" | "decline" | "undo",
    roleIds?: number[],
    capabilities?: BewtsCapability[],
    notifId?: number,
  ) => {
    const payload: Record<string, unknown> = { action };
    if (action === "approve") {
      (payload as Record<string, unknown>)["roleIds"] = roleIds ?? [];
      (payload as Record<string, unknown>)["capabilities"] = capabilities ?? [
        "SCOUT",
      ];
    }

    const res = await fetch(`/api/bewts/join-request/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErrorModal({
        title: "参加申請の処理に失敗しました",
        message:
          (data?.error as string | undefined) ||
          "時間をおいて再度お試しください。",
      });
      return;
    }

    // ローカル UI を即時更新して Admin が通知から承認した直後に
    // 「承認（確定待ち）/ 見送り（確定待ち）」や「元に戻す」を見られるようにする
    setLocalNotifications((prev) =>
      prev.map((n) => {
        const matches =
          (n.bewtsJoinRequest && n.bewtsJoinRequest.id === requestId) ||
          (typeof notifId === "number" && n.id === notifId);
        if (!matches) return n;

        if (action === "approve" || action === "decline") {
          return {
            ...n,
            type:
              action === "approve"
                ? "BEWTS_JOIN_APPROVED"
                : "BEWTS_JOIN_DECLINED",
            bewtsJoinRequest: {
              id: n.bewtsJoinRequest?.id ?? requestId,
              status: action === "approve" ? "APPROVED" : "DECLINED",
              message: n.bewtsJoinRequest?.message ?? null,
              updatedAt: new Date().toISOString(),
              roleId: roleIds?.[0] ?? n.bewtsJoinRequest?.roleId ?? null,
              roleIds:
                action === "approve"
                  ? (roleIds ?? [])
                  : (n.bewtsJoinRequest?.roleIds ?? []),
              capabilities:
                action === "approve"
                  ? (capabilities ?? ["SCOUT"])
                  : (n.bewtsJoinRequest?.capabilities ?? ["SCOUT"]),
              canUndo: true,
            },
          };
        }

        // undo の場合は元に戻す（ローカル上は PENDING 表示へ）
        return {
          ...n,
          type: "BEWTS_JOIN_REQUEST",
          bewtsJoinRequest: {
            id: n.bewtsJoinRequest?.id ?? requestId,
            status: "PENDING",
            message: n.bewtsJoinRequest?.message ?? null,
            updatedAt: new Date().toISOString(),
            roleId: n.bewtsJoinRequest?.roleId ?? null,
            roleIds: n.bewtsJoinRequest?.roleIds ?? [],
            capabilities: n.bewtsJoinRequest?.capabilities ?? ["SCOUT"],
            canUndo: false,
          },
        };
      }),
    );

    // undo のときは確実にサーバー側と同期させる（通知の差し替えなど）
    if (action === "undo") router.refresh();
  };

  const openConfirmModal = (
    payload: ConfirmNotificationState,
    roles?: Array<{ id: number; name: string }>,
  ) => {
    setConfirmNotif(payload);
    setConfirmNotifRoles(roles ?? []);
    setConfirmOpen(true);
  };

  return (
    <div className={styles.page}>
      <div className={styles.tabArea}>
        <div className={styles.tabTop}>
          <div ref={tabbedRef} className={styles.tabbed}>
            <div ref={indicatorRef} className={styles.tabbedIndicator} />
            <button
              type="button"
              className={clsx(styles.tabBtn, {
                [styles.activeTab]: activeTab === "history",
              })}
              data-tab="history"
              onClick={() => setActiveTab("history")}
            >
              通知履歴
            </button>
            <button
              type="button"
              className={clsx(styles.tabBtn, {
                [styles.activeTab]: activeTab === "settings",
              })}
              data-tab="settings"
              onClick={() => setActiveTab("settings")}
            >
              通知設定
            </button>
          </div>
        </div>
      </div>

      {activeTab === "history" && (
        <div className={styles.historyPanel}>
          <div className={styles.notificationList}>
            {localNotifications.length === 0 && (
              <p className={styles.empty}>通知はありません</p>
            )}

            {localNotifications.map((notif) => {
              return (
                <NotificationHistoryItem
                  key={notif.id}
                  notif={notif}
                  following={Boolean(following[notif.id])}
                  formatTimeAgo={formatTimeAgo}
                  markAsRead={markAsRead}
                  onNotificationClick={handleNotificationClick}
                  onToggleFollow={toggleFollow}
                  onOpenConfirm={openConfirmModal}
                />
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "settings" && (
        <>
          <div className={styles.notificationGroupHeader}>
            <Link
              href="/mypage/settings?tab=notifications"
              className={styles.notificationSettingsLink}
              aria-label="設定画面の通知設定を開く"
            >
              <Image
                src="/images/mypage-nav/settings.png"
                alt="設定"
                width={18}
                height={18}
                className={styles.notificationSettingsIcon}
              />
            </Link>
            <div className={styles.notificationGroupAll}>
              <span className={styles.notificationGroupAllLabel}>すべて</span>
              <SidebarToggle
                id="notifs-page-all-enabled"
                checked={isAllEnabled}
                onChange={() => void handleAllToggle()}
                inputClassName={toggleStyles.toggleInput}
                toggleClassName={toggleStyles.toggle}
                knobClassName={toggleStyles.knob}
              />
            </div>
          </div>
          <div className={styles.settingsPanel}>
            <div className={styles.notificationGroup}>
              {SIMPLE_NOTIFICATION_ITEMS.map((item) => {
                const checked = item.keys.every(
                  (key) => notificationSettings[key],
                );
                return (
                  <div key={item.id} className={styles.notificationSettingRow}>
                    <div>
                      <div className={styles.notificationSettingLabel}>
                        {item.label}
                      </div>
                      <div className={styles.notificationSettingDesc}>
                        {item.desc}
                      </div>
                    </div>
                    <SidebarToggle
                      id={item.id}
                      checked={checked}
                      onChange={() =>
                        void handleNotificationItemToggle(item.keys)
                      }
                      inputClassName={toggleStyles.toggleInput}
                      toggleClassName={toggleStyles.toggle}
                      knobClassName={toggleStyles.knob}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* 承認／見送りの確認モーダル（通知からの操作用） */}
      {confirmNotif && (
        <UserConfirmModal
          open={confirmOpen}
          onOpenChange={(o) => {
            if (!o && confirmProcessing) return;
            setConfirmOpen(o);
            if (!o) {
              setConfirmNotif(null);
              setConfirmNotifRoles([]);
            }
          }}
          title={
            confirmNotif.action === "approve"
              ? "この申請を承認しますか？"
              : confirmNotif.action === "decline"
                ? "この申請を見送りますか？"
                : "取り消しますか？"
          }
          description={
            confirmNotif.action === "approve"
              ? "この申請を承認しますか？（1分以内に取り消せます）"
              : confirmNotif.action === "decline"
                ? "この申請を見送りますか？（1分以内に取り消せます）"
                : "この処理を元に戻します。取り消しは 1 分以内のみ可能です。"
          }
          userName={confirmNotif.userName}
          userImage={confirmNotif.userImage}
          confirmLabel={
            confirmNotif.action === "approve"
              ? "承認する"
              : confirmNotif.action === "decline"
                ? "見送る"
                : "元に戻す"
          }
          cancelLabel="キャンセル"
          variant={
            confirmNotif.action === "approve"
              ? "approve"
              : confirmNotif.action === "decline"
                ? "block"
                : "unblock"
          }
          processing={confirmProcessing}
          onConfirm={async () => {
            if (!confirmNotif) return;
            if (
              confirmNotif.action === "approve" &&
              (!confirmNotif.roleIds || confirmNotif.roleIds.length === 0)
            ) {
              setErrorModal({
                title: "役割の指定が必要です",
                message: "承認時は少なくとも1つの役割を選択してください。",
              });
              return;
            }
            if (
              confirmNotif.action === "approve" &&
              (!confirmNotif.capabilities ||
                confirmNotif.capabilities.length === 0)
            ) {
              setErrorModal({
                title: "権限の指定が必要です",
                message: "承認時は少なくとも1つの権限を選択してください。",
              });
              return;
            }
            setConfirmProcessing(true);
            try {
              await handleJoinRequestAction(
                confirmNotif.requestId,
                confirmNotif.action,
                confirmNotif.roleIds,
                confirmNotif.capabilities,
                confirmNotif.notificationId,
              );
              setConfirmOpen(false);
            } finally {
              setConfirmProcessing(false);
            }
          }}
        >
          {confirmNotif.action === "approve" &&
            confirmNotifRoles.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  marginBottom: 24,
                  display: "grid",
                  gap: 12,
                }}
              >
                <div style={{ display: "block" }}>
                  割り当てる役割（必須 / 複数可）
                </div>
                <RolePicker
                  roles={confirmNotifRoles}
                  selectedRoleIds={confirmNotif.roleIds ?? []}
                  onChange={(roleIds) =>
                    setConfirmNotif((prev) =>
                      prev
                        ? {
                            ...prev,
                            roleIds,
                            roleId: roleIds[0] ?? null,
                          }
                        : prev,
                    )
                  }
                  placeholder="承認役割を選択"
                  maxItems={10}
                  disabled={confirmProcessing}
                />

                <div style={{ display: "block", marginTop: 24 }}>
                  付与する権限（必須 / 複数可）
                </div>
                <BewtsCapabilityPicker
                  selectedCapabilities={
                    (confirmNotif.capabilities ?? [
                      "SCOUT",
                    ]) as BewtsCapability[]
                  }
                  onChange={(capabilities) =>
                    setConfirmNotif((prev) =>
                      prev
                        ? {
                            ...prev,
                            capabilities,
                          }
                        : prev,
                    )
                  }
                  disabled={confirmProcessing}
                  placeholder="承認権限を選択"
                />
              </div>
            )}
        </UserConfirmModal>
      )}

      <ErrorModal
        open={Boolean(errorModal)}
        onClose={() => setErrorModal(null)}
        title={errorModal?.title ?? ""}
        message={errorModal?.message ?? ""}
      />
    </div>
  );
}
