import Image from "next/image";
import styles from "../sidebar.module.scss";

export default function Top() {
  return (
    <Image
      className={styles.sidebarIcon}
      src="/icons/sidebar/top-outlined.png"
      alt="トップ"
      width={24}
      height={24}
    />
  );
}
