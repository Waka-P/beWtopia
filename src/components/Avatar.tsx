import { cn } from "@/lib/cn";
import Image from "next/image";
import styles from "./Avatar.module.scss";

type AvatarProps = {
  src: string | null;
  alt: string;
  className?: string;
};

export default function Avatar({ src, alt, className = "" }: AvatarProps) {
  return (
    <span className={cn(styles.avatarWrapper, className)}>
      <Image
        src={src || "/images/user-icon-default.png"}
        alt={alt}
        className={cn(styles.avatar)}
        width={80}
        height={80}
      />
    </span>
  );
}
