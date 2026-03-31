import type { Metadata } from "next";
import ForgotPassSuccess from "./ForgotPassSuccess";

export const metadata: Metadata = {
  title: "パスワードリセットのリクエスト完了",
};

export default async function ForgotPasswordSuccessPage() {
  return <ForgotPassSuccess />;
}
