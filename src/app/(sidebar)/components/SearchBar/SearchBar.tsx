"use client";

import { cn } from "@/lib/cn";
import Image from "next/image";
import type React from "react";
import styles from "./SearchBar.module.scss";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSubmit?: () => void;
};

export default function SearchBar({
  value,
  onChange,
  placeholder = "",
  className,
  onKeyDown,
  onSubmit,
}: SearchBarProps) {
  return (
    <div className={cn(styles.searchBar, className)}>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.();
        }}
      >
        <button type="submit" className={styles.button}>
          <Image src="/images/search.png" width={20} height={20} alt="検索" />
        </button>
        <input
          type="text"
          placeholder={placeholder}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          className={styles.input}
        />
      </form>
    </div>
  );
}
