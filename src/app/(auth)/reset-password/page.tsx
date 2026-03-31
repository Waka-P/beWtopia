import type { Metadata } from "next";
import ResetPassword from "./ResetPassword";

export const metadata: Metadata = {
  title: "パスワードをリセット",
};

export default function ResetPasswordPage() {
  return <ResetPassword />;
}
