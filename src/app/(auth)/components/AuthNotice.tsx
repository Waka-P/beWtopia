"use client";

import NoticeModal from "@/components/NoticeModal";

export default function AuthNotice({
  isOpen,
  onClose,
  children,
  classNames = {},
}: {
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  classNames?: Partial<{
    overlay: string;
    content: string;
  }>;
}) {
  return (
    <NoticeModal isOpen={isOpen} onClose={onClose} classNames={classNames}>
      {children}
    </NoticeModal>
  );
}
