"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";

export type MypageAppsHeaderControls = {
  left?: ReactNode;
  right?: ReactNode;
};

type MypageAppsHeaderControlsContextValue = {
  controls: MypageAppsHeaderControls;
  setControls: (value: MypageAppsHeaderControls) => void;
};

const MypageAppsHeaderControlsContext =
  createContext<MypageAppsHeaderControlsContextValue | null>(null);

export function MypageAppsHeaderControlsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [controls, setControls] = useState<MypageAppsHeaderControls>({});

  return (
    <MypageAppsHeaderControlsContext.Provider value={{ controls, setControls }}>
      {children}
    </MypageAppsHeaderControlsContext.Provider>
  );
}

export function useMypageAppsHeaderControls() {
  const ctx = useContext(MypageAppsHeaderControlsContext);
  if (!ctx) {
    throw new Error(
      "useMypageAppsHeaderControls must be used within MypageAppsHeaderControlsProvider",
    );
  }
  return ctx;
}
