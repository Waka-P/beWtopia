import RequestForm from "@/app/(sidebar)/requests/new/components/RequestForm";
import type { RequestFormData } from "@/app/schemas/requestSchema";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { truncate } from "@/utils/truncate";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  const request = await prisma.request.findUnique({
    where: { publicId },
    select: { title: true },
  });

  if (!request) {
    notFound();
  }

  return {
    title: `リクエスト - ${truncate(request.title, 15)}の編集`,
  };
}

type EditRequestPageProps = {
  params: Promise<{
    publicId: string;
  }>;
};

export default async function EditRequestPage({
  params,
}: EditRequestPageProps) {
  const { publicId } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = Number.parseInt(session.user.id, 10);

  const [tags, request] = await Promise.all([
    prisma.tag.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.request.findUnique({
      where: { publicId },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    }),
  ]);

  if (!request) {
    notFound();
  }

  if (request.userId !== userId) {
    redirect(`/requests/${publicId}`);
  }

  const initialValues: RequestFormData = {
    title: request.title,
    content: request.content,
    tags: request.tags.map((t) => t.tagId),
    newTagNames: [],
  };

  return (
    <div>
      <RequestForm
        tags={tags}
        initialValues={initialValues}
        requestPublicId={publicId}
      />
    </div>
  );
}
