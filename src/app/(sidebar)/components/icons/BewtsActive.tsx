import Image from "next/image";
import styles from "../sidebar.module.scss";

export default function BewtsActive() {
  return (
    <Image
      className={styles.sidebarIcon}
      src="/icons/sidebar/bewts-filled.png"
      alt="ビューズ"
      width={24}
      height={24}
    />
  );
}
