"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";

export type SearchHeaderControls = {
  left?: ReactNode;
  right?: ReactNode;
};

type SearchHeaderControlsContextValue = {
  controls: SearchHeaderControls;
  setControls: (value: SearchHeaderControls) => void;
};

const SearchHeaderControlsContext =
  createContext<SearchHeaderControlsContextValue | null>(null);

export function SearchHeaderControlsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [controls, setControls] = useState<SearchHeaderControls>({});

  return (
    <SearchHeaderControlsContext.Provider value={{ controls, setControls }}>
      {children}
    </SearchHeaderControlsContext.Provider>
  );
}

export function useSearchHeaderControls() {
  const ctx = useContext(SearchHeaderControlsContext);
  if (!ctx) {
    throw new Error(
      "useSearchHeaderControls must be used within SearchHeaderControlsProvider",
    );
  }
  return ctx;
}
