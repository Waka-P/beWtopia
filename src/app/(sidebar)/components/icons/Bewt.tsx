import Image from "next/image";
import styles from "../sidebar.module.scss";

export default function Bewt() {
  return (
    <Image
      className={styles.sidebarIcon}
      src="/icons/sidebar/bewt-outlined.png"
      alt="ビュート"
      width={24}
      height={24}
    />
  );
}
