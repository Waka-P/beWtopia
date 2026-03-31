import ReviewFormClient from "@/app/(sidebar)/apps/[publicId]/reviews/ReviewFormClient";
import { Modal } from "@/components/Modal";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{
    publicId: string;
  }>;
};

export default async function ModalReviewEdit({ params }: Props) {
  const { publicId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !session.user?.id) {
    notFound();
  }

  const userId = Number(session.user.id);

  const app = await prisma.app.findUnique({ where: { publicId } });
  if (!app) {
    notFound();
  }

  const review = await prisma.appReview.findFirst({
    where: { appId: app.id, userId },
    select: { id: true, rating: true, body: true },
  });

  if (!review) {
    notFound();
  }

  return (
    <Modal
      open
      title="レビューを編集"
      description="既存のレビューを編集します"
      useRouterBack
    >
      <ReviewFormClient
        appPublicId={publicId}
        initialValues={{
          id: review.id,
          rating: review.rating.toNumber(),
          body: review.body,
        }}
      />
    </Modal>
  );
}
