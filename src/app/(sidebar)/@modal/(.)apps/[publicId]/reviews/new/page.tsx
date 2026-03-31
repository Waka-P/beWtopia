"use client";

import ReviewFormClient from "@/app/(sidebar)/apps/[publicId]/reviews/ReviewFormClient";
import { Modal } from "@/components/Modal";
import { useParams } from "next/navigation";

export default function ModalReview() {
  const params = useParams();

  return (
    <Modal
      open
      title="レビューを投稿"
      description="このアプリに対するレビューを投稿します"
      useRouterBack
    >
      <ReviewFormClient appPublicId={params.publicId as string} />
    </Modal>
  );
}
