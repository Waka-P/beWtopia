import { AuthUIProvider } from "@/app/(auth)/contexts/AuthUIContext";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthUIProvider>{children}</AuthUIProvider>;
}
