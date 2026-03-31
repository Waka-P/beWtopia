import Image from "next/image";
import styles from "../sidebar.module.scss";

export default function BewtActive() {
  return (
    <Image
      className={styles.sidebarIcon}
      src="/icons/sidebar/bewt-filled.png"
      alt="ビュート"
      width={24}
      height={24}
    />
  );
}
