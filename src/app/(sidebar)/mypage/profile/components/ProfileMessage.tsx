"use client";

import { cn } from "@/lib/cn";
import styles from "../page.module.scss";

type ProfileMessageProps = {
  message: string | null;
  messageType: "success" | "error" | null;
};

export function ProfileMessage({ message, messageType }: ProfileMessageProps) {
  if (!message) return null;

  const typeClass =
    messageType === "success"
      ? styles.messageSuccess
      : messageType === "error"
        ? styles.messageError
        : "";

  return <p className={cn(styles.message, typeClass)}>{message}</p>;
}
