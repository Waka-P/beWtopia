import Image from "next/image";
import styles from "../sidebar.module.scss";

export default function Notifs() {
  return (
    <Image
      className={styles.sidebarIcon}
      src="/icons/sidebar/notif-outlined.png"
      alt="通知"
      width={24}
      height={24}
    />
  );
}
