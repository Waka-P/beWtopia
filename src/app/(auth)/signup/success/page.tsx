import type { Metadata } from "next";
import SignupSuccess from "./SignUpSuccess";

export const metadata: Metadata = {
  title: "アカウント作成完了",
};

export default function SignupSuccessPage() {
  return <SignupSuccess />;
}
