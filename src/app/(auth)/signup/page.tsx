import UserAuthForm from "@/app/(auth)/components/UserAuthForm";
import { auth } from "@/lib/auth";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "新規登録",
};

export default async function SignupPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (session) {
    redirect("/");
  }

  return <UserAuthForm mode="signup" />;
}
