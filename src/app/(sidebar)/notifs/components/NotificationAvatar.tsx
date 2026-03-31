import Avatar from "@/components/Avatar";
import { cn } from "@/lib/cn";
import Image from "next/image";
import { LuClipboardList } from "react-icons/lu";
import { RiSpeakFill } from "react-icons/ri";
import styles from "../Notifications.module.scss";
import type { NotificationItem } from "../types";

type NotificationBadgeKind =
  | "follow"
  | "bewt"
  | "purchase"
  | "chat"
  | "scout"
  | "order"
  | "bewts"
  | "system";

type Props = {
  notif: NotificationItem;
};

function getNotificationBadgeKind(
  notif: NotificationItem,
): NotificationBadgeKind {
  switch (notif.type) {
    case "FOLLOW":
      return "follow";
    case "BEWT":
      return "bewt";
    case "PURCHASE":
      return "purchase";
    case "CHAT":
      return "chat";
    case "SCOUT":
      return "scout";
    case "ORDER":
      return "order";
    case "BEWTS_JOIN_REQUEST":
    case "BEWTS_JOIN_APPROVED":
    case "BEWTS_JOIN_DECLINED":
      return "bewts";
    case "SYSTEM":
      return "system";
    default:
      return "system";
  }
}

function CategoryIcon({ kind }: { kind: NotificationBadgeKind }) {
  if (kind === "follow") {
    return (
      <Image
        src="/images/follow.png"
        width={507}
        height={506}
        alt="フォロー"
        className={styles.categoryIconImg}
      />
    );
  }

  if (kind === "bewt") {
    return (
      <Image
        src="/icons/sidebar/bewt-filled.png"
        width={100}
        height={100}
        alt="ビュート"
        className={styles.categoryIconImg}
      />
    );
  }

  if (kind === "purchase") {
    return (
      <Image
        src="/icons/sidebar/bewt-filled.png"
        width={100}
        height={100}
        alt="購入"
        className={styles.categoryIconImg}
      />
    );
  }

  if (kind === "chat") {
    return (
      <Image
        src="/icons/sidebar/chat-filled.png"
        width={100}
        height={100}
        alt="チャット"
        className={styles.categoryIconImg}
      />
    );
  }
  if (kind === "scout") {
    return <RiSpeakFill />;
  }

  if (kind === "order") {
    return <LuClipboardList />;
  }

  if (kind === "bewts") {
    return (
      <Image
        src="/icons/sidebar/bewts-filled.png"
        width={100}
        height={100}
        alt="ビューズ"
        className={styles.categoryIconImg}
      />
    );
  }
  return null;
}

export default function NotificationAvatar({ notif }: Props) {
  const isAppNotification = Boolean(notif.app?.appIconUrl);

  if (isAppNotification && notif.app) {
    return (
      <div className={styles.avatarWrap}>
        <Image
          src={notif.app.appIconUrl ?? "/images/logo.png"}
          alt={notif.app.name}
          className={cn(styles.avatar)}
          style={{ borderRadius: "0.75rem", objectFit: "cover" }}
          width={60}
          height={60}
        />
      </div>
    );
  }

  if (!notif.actor) {
    return (
      <div className={styles.avatarWrap}>
        <Image
          src="/images/logo.png"
          alt="ユーザー"
          className={cn(styles.avatar)}
          width={60}
          height={60}
        />
      </div>
    );
  }

  const kind = getNotificationBadgeKind(notif);

  return (
    <div className={styles.avatarWrap}>
      <Avatar
        src={notif.actor.image}
        alt={notif.actor.name}
        className={styles.avatar}
      />
      <div className={cn(styles.avatarBadge)}>
        <CategoryIcon kind={kind} />
      </div>
    </div>
  );
}
