"use client";

import LoginForm from "@/app/(auth)/components/UserAuthForm/LoginForm";
import SignUpForm from "@/app/(auth)/components/UserAuthForm/SignUpForm";
import StartScreen from "@/app/(auth)/components/UserAuthForm/StartScreen";
import { useAuthUI } from "@/app/(auth)/contexts/AuthUIContext";
import { authClient } from "@/lib/auth-client";
import { useEffect, useState } from "react";

type Mode = "login" | "signup";

type Props = {
  mode: Mode;
};

export default function UserAuthForm({ mode }: Props) {
  const { isStartScreen, setIsStartScreen } = useAuthUI();
  const [hoverLocked, setHoverLocked] = useState(false);
  const [hasStartedOnce, setHasStartedOnce] = useState(false);

  const handleStartClick = () => {
    setHoverLocked(true);
    setHasStartedOnce(true);
    setIsStartScreen(false);
    setTimeout(() => {
      setHoverLocked(false);
    }, 500);
  };

  useEffect(() => {
    const showOneTap = async () => {
      await authClient.oneTap();
    };
    showOneTap();
  }, []);

  if (isStartScreen) {
    return (
      <StartScreen hoverLocked={hoverLocked} onStartClick={handleStartClick} />
    );
  }

  return mode === "login" ? (
    <LoginForm
      hoverLocked={hoverLocked}
      noAnimateStartScreen={!hasStartedOnce}
    />
  ) : (
    <SignUpForm
      hoverLocked={hoverLocked}
      noAnimateStartScreen={!hasStartedOnce}
    />
  );
}
