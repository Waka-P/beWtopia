import { cn } from "@/lib/cn";
import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent } from "react";
import { useEffect, useState } from "react";
import Emoji from "../../components/Emoji";
import styles from "../Notifications.module.scss";
import type { ConfirmNotificationState, NotificationItem } from "../types";
import NotificationAvatar from "./NotificationAvatar";

type Props = {
  notif: NotificationItem;
  following: boolean;
  formatTimeAgo: (isoDate: string) => string;
  markAsRead: (notifId: number) => Promise<void>;
  onNotificationClick: (notif: NotificationItem) => Promise<void>;
  onToggleFollow: (notifId: number, actorId: number) => void;
  onOpenConfirm: (
    payload: ConfirmNotificationState,
    roles?: Array<{ id: number; name: string }>,
  ) => void;
};

export default function NotificationHistoryItem({
  notif,
  following,
  formatTimeAgo,
  markAsRead,
  onNotificationClick,
  onToggleFollow,
  onOpenConfirm,
}: Props) {
  const router = useRouter();
  const [likedByMe, setLikedByMe] = useState<boolean | null>(null);
  const [isLikeProcessing, setIsLikeProcessing] = useState(false);

  const parseChatReactionTarget = (href: string) => {
    try {
      const url = new URL(href, "http://localhost");
      const pathMatch = url.pathname.match(/^\/chat\/([^/]+)$/);
      const roomPublicId = pathMatch?.[1] ?? null;
      const messagePublicId = url.searchParams.get("messagePublicId");
      if (!roomPublicId || !messagePublicId) return null;
      return {
        roomPublicId,
        messagePublicId,
        notifKind: url.searchParams.get("notifKind"),
      };
    } catch {
      return null;
    }
  };

  const hasJoinRequestMultipleActions =
    notif.type === "BEWTS_JOIN_REQUEST" &&
    notif.bewtsJoinRequest?.status === "PENDING";

  const redirectUrl = notif.redirectUrl ?? "";
  const reactionTarget = parseChatReactionTarget(redirectUrl);

  const isReactionNotification =
    notif.type === "CHAT" &&
    (reactionTarget?.notifKind === "reaction" ||
      notif.title.includes("リアクションしました"));

  const hasReplyReactionActions =
    !isReactionNotification &&
    (notif.type === "CHAT" || notif.type === "SCOUT") &&
    Boolean(notif.redirectUrl);

  const hasMultipleActions =
    hasJoinRequestMultipleActions || hasReplyReactionActions;

  const isRowLink = Boolean(notif.redirectUrl) && !hasMultipleActions;

  useEffect(() => {
    if (!reactionTarget) return;

    let canceled = false;

    const loadInitialLikeState = async () => {
      try {
        const res = await fetch(
          `/api/chat/rooms/${reactionTarget.roomPublicId}/messages/${reactionTarget.messagePublicId}/reactions?emoji=${encodeURIComponent("👍")}`,
        );
        if (!res.ok) return;

        const data = (await res.json().catch(() => null)) as {
          userReacted?: boolean;
        } | null;
        if (!canceled && typeof data?.userReacted === "boolean") {
          setLikedByMe(data.userReacted);
        }
      } catch {
        // noop
      }
    };

    void loadInitialLikeState();

    return () => {
      canceled = true;
    };
  }, [reactionTarget]);

  const handleInlineLinkAction = async (
    e: MouseEvent<HTMLButtonElement>,
    href: string,
  ) => {
    e.stopPropagation();

    if (!notif.isRead) {
      await markAsRead(notif.id);
    }

    if (notif.type === "SCOUT") {
      await onNotificationClick(notif);
      return;
    }

    router.push(href);
  };

  const handleQuickLikeAction = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!reactionTarget) return;
    if (isLikeProcessing) return;

    if (!notif.isRead) {
      await markAsRead(notif.id);
    }

    setIsLikeProcessing(true);
    try {
      const res = await fetch(
        `/api/chat/rooms/${reactionTarget.roomPublicId}/messages/${reactionTarget.messagePublicId}/reactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji: "👍" }),
        },
      );

      if (!res.ok) return;

      const data = (await res.json().catch(() => null)) as {
        action?: "added" | "removed";
      } | null;

      if (data?.action === "added") {
        setLikedByMe(true);
      } else if (data?.action === "removed") {
        setLikedByMe(false);
      } else {
        setLikedByMe((prev) => (prev == null ? true : !prev));
      }
    } finally {
      setIsLikeProcessing(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!isRowLink) return;
    if (e.key === "Enter" || e.key === " ") {
      void onNotificationClick(notif);
    }
  };

  return (
    // biome-ignore lint: hydrationエラー防止のため、role="button" と tabIndex を付与して div をクリック可能にする
    <div
      key={notif.id}
      role="button"
      tabIndex={isRowLink ? 0 : -1}
      className={cn(
        styles.notificationItem,
        !notif.isRead && styles.unread,
        !isRowLink && styles.notificationItemStatic,
      )}
      onClick={() => {
        if (isRowLink) {
          void onNotificationClick(notif);
          return;
        }

        if (!notif.isRead) {
          void markAsRead(notif.id);
        }
      }}
      onKeyDown={handleKeyDown}
    >
      <NotificationAvatar notif={notif} />

      <div className={styles.notificationBody}>
        <div className={styles.notificationTitle}>{notif.title}</div>
        <div className={styles.notificationTime}>
          {formatTimeAgo(notif.createdAt)}
        </div>

        {notif.message && (
          <div className={styles.notificationPreview}>
            {isReactionNotification ? (
              <Emoji emoji={notif.message} size={18} style="apple" />
            ) : (
              notif.message
            )}
          </div>
        )}

        {notif.bewtsJoinRequest && notif.bewtsProject && (
          <div className={styles.joinMeta}>
            {notif.bewtsProject.maxMembers != null && (
              <div className={styles.joinMetaBlock}>
                {(() => {
                  const memberCount = notif.bewtsProject?.memberCount ?? 0;
                  const maxMembers = notif.bewtsProject?.maxMembers ?? 0;
                  const nearFull = maxMembers - memberCount <= 1;

                  return (
                    <>
                      <div
                        className={cn(
                          styles.memberCountBadge,
                          nearFull && styles.nearFull,
                        )}
                      >
                        {memberCount}/{maxMembers}名
                      </div>

                      {typeof notif.bewtsProject?.totalCapacity ===
                        "number" && (
                        <div className={styles.joinTotal}>
                          （総員: {notif.bewtsProject?.totalMemberCount}/
                          {notif.bewtsProject?.totalCapacity}名）
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {notif.bewtsJoinRequest.roleId ||
            (notif.bewtsJoinRequest.roleIds ?? []).length > 0 ? (
              <span className={styles.joinRole}>
                <span>希望役割</span>{" "}
                {(notif.bewtsJoinRequest.roleIds &&
                notif.bewtsJoinRequest.roleIds.length > 0
                  ? notif.bewtsJoinRequest.roleIds
                      .map(
                        (roleId) =>
                          notif.bewtsProject?.roles?.find(
                            (r) => r.id === roleId,
                          )?.name,
                      )
                      .filter((name): name is string => Boolean(name))
                      .join(" / ")
                  : undefined) ||
                  notif.bewtsProject.roles?.find(
                    (r) => r.id === notif.bewtsJoinRequest?.roleId,
                  )?.name ||
                  "—"}
              </span>
            ) : null}

            {notif.bewtsJoinRequest.status !== "PENDING" &&
            notif.bewtsJoinRequest.canUndo ? (
              <span className={styles.joinStatus}>
                {notif.bewtsJoinRequest.status === "APPROVED"
                  ? "承認（確定待ち）"
                  : "見送り（確定待ち）"}
              </span>
            ) : null}
          </div>
        )}

        {hasJoinRequestMultipleActions && notif.bewtsProject?.viewerIsAdmin ? (
          <div className={styles.notificationActions}>
            <button
              type="button"
              className={styles.actionLink}
              onClick={(e) => {
                e.stopPropagation();
                if (notif.bewtsJoinRequest && notif.actor) {
                  onOpenConfirm(
                    {
                      notificationId: notif.id,
                      requestId: notif.bewtsJoinRequest.id,
                      action: "approve",
                      roleId: notif.bewtsJoinRequest?.roleId ?? null,
                      roleIds:
                        notif.bewtsJoinRequest?.roleIds ??
                        (notif.bewtsJoinRequest?.roleId
                          ? [notif.bewtsJoinRequest.roleId]
                          : []),
                      capabilities: notif.bewtsJoinRequest?.capabilities ?? [
                        "SCOUT",
                      ],
                      userName: notif.actor.name,
                      userImage: notif.actor.image,
                    },
                    notif.bewtsProject?.roles ?? [],
                  );
                }
              }}
            >
              承認する
            </button>
            <button
              type="button"
              className={styles.actionLink}
              onClick={(e) => {
                e.stopPropagation();
                if (notif.bewtsJoinRequest && notif.actor) {
                  onOpenConfirm({
                    notificationId: notif.id,
                    requestId: notif.bewtsJoinRequest.id,
                    action: "decline",
                    userName: notif.actor.name,
                    userImage: notif.actor.image,
                  });
                }
              }}
            >
              見送る
            </button>
          </div>
        ) : hasReplyReactionActions ? (
          <div className={styles.notificationActions}>
            <button
              type="button"
              className={styles.actionLink}
              onClick={(e) => void handleInlineLinkAction(e, redirectUrl)}
            >
              返信する
            </button>
            {reactionTarget ? (
              <button
                type="button"
                className={styles.actionLink}
                disabled={isLikeProcessing}
                onClick={(e) => void handleQuickLikeAction(e)}
              >
                {likedByMe ? "いいねを取り消す" : "いいね"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={styles.notificationRight}>
        {notif.type === "FOLLOW" && notif.actor && (
          <button
            type="button"
            className={cn(styles.followBtn, following && styles.following)}
            onClick={(e) => {
              e.stopPropagation();
              if (!notif.actor) return;
              onToggleFollow(notif.id, notif.actor.id);
            }}
          >
            {following ? "フォロー中" : "フォロー"}
          </button>
        )}

        {notif.bewtsJoinRequest &&
          (notif.type === "BEWTS_JOIN_APPROVED" ||
            notif.type === "BEWTS_JOIN_DECLINED") &&
          notif.bewtsJoinRequest.canUndo && (
            <button
              type="button"
              className={styles.sideActionBtn}
              onClick={(e) => {
                e.stopPropagation();
                if (!notif.bewtsJoinRequest) return;
                onOpenConfirm({
                  notificationId: notif.id,
                  requestId: notif.bewtsJoinRequest.id,
                  action: "undo",
                  userName: notif.actor?.name ?? "—",
                  userImage: notif.actor?.image ?? null,
                });
              }}
            >
              元に戻す
            </button>
          )}
      </div>
    </div>
  );
}
