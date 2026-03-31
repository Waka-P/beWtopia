import type { Metadata } from "next";
import ResendVerification from "./ResendVerification";

export const metadata: Metadata = {
  title: "認証メールを再送信",
};

export default function ResendVerificationPage() {
  return <ResendVerification />;
}
