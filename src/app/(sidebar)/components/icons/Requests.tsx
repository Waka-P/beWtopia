import Image from "next/image";
import styles from "../sidebar.module.scss";

export default function Request() {
  return (
    <Image
      className={styles.sidebarIcon}
      src="/icons/sidebar/request-outlined.png"
      alt="リクエスト"
      width={24}
      height={24}
    />
  );
}
