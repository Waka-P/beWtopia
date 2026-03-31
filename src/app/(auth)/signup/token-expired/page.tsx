import type { Metadata } from "next";
import SignUpTokenExpired from "./SignUpTokenExpired";

export const metadata: Metadata = {
  title: "アカウント確認の有効期限切れ",
};

export default function SignUpTokenExpiredPage() {
  return <SignUpTokenExpired />;
}
