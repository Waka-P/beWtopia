"use client";
import { createContext, useContext, useState } from "react";

type AuthUIContextType = {
  isStartScreen: boolean;
  setIsStartScreen: (v: boolean) => void;
  isIconTrayOpen: boolean;
  setIsIconTrayOpen: (v: boolean) => void;
};

const AuthUIContext = createContext<AuthUIContextType | null>(null);

export function AuthUIProvider({ children }: { children: React.ReactNode }) {
  const [isStartScreen, setIsStartScreen] = useState(true);
  const [isIconTrayOpen, setIsIconTrayOpen] = useState(false);

  return (
    <AuthUIContext.Provider
      value={{
        isStartScreen,
        setIsStartScreen,
        isIconTrayOpen,
        setIsIconTrayOpen,
      }}
    >
      {children}
    </AuthUIContext.Provider>
  );
}

export function useAuthUI() {
  const ctx = useContext(AuthUIContext);
  if (!ctx) {
    throw new Error("useAuthUI must be used within AuthProvider");
  }
  return ctx;
}
