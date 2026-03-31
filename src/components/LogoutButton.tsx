"use client";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./LogoutButton.module.scss";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login"); // Redirect to login page
        },
      },
    });
  };

  return (
    <button type="button" onClick={handleLogout}>
      <Image
        src="/images/logout.png"
        width={1264}
        height={1425}
        alt="ログアウト"
        className={styles.logoutImage}
      />
    </button>
  );
}
