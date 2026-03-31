"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getSidebarOpen } from "../sidebarMenu";

type SidebarContextType = {
  isOpen: boolean;
  toggleOpen: () => void;
  indicatorTop: number;
  setIndicatorTop: (top: number) => void;
  indicatorAnimated: boolean;
  enableIndicatorAnimation: () => void;
  indicatorVisible: boolean;
  setIndicatorVisible: (visible: boolean) => void;
  staticIndicatorVisible: boolean;
  setStaticIndicatorVisible: (visible: boolean) => void;
};

const SidebarContext = createContext<SidebarContextType | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [indicatorTop, setIndicatorTop] = useState(0);
  const [indicatorAnimated, setIndicatorAnimated] = useState(false);
  const [indicatorVisible, setIndicatorVisible] = useState(false);
  const [staticIndicatorVisible, setStaticIndicatorVisible] = useState(true);

  useEffect(() => {
    const savedIsOpen = getSidebarOpen();
    setIsOpen(savedIsOpen);
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        toggleOpen: () => setIsOpen((v) => !v),
        indicatorTop,
        setIndicatorTop,
        indicatorAnimated,
        enableIndicatorAnimation: () => setIndicatorAnimated(true),
        indicatorVisible,
        setIndicatorVisible,
        staticIndicatorVisible,
        setStaticIndicatorVisible,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
