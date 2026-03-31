import Image from "next/image";
import styles from "../sidebar.module.scss";

export default function TopActive() {
  return (
    <Image
      className={styles.sidebarIcon}
      src="/icons/sidebar/top-filled.png"
      alt="トップ"
      width={24}
      height={24}
    />
  );
}
