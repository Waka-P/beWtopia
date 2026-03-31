import Image from "next/image";
import styles from "../sidebar.module.scss";

export default function NotifsActive() {
  return (
    <Image
      className={styles.sidebarIcon}
      src="/icons/sidebar/notif-filled.png"
      alt="通知"
      width={24}
      height={24}
    />
  );
}
