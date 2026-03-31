import type { BewtFormData } from "@/app/schemas/bewtSchema";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { truncate } from "@/utils/truncate";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { EditBewtForm } from "./EditBewtForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  const app = await prisma.app.findUnique({
    where: { publicId },
    select: { name: true },
  });

  if (!app) {
    notFound();
  }

  return {
    title: `アプリ - ${truncate(app.name, 15)}の編集`,
  };
}

async function getTags(userId: number) {
  const globalTags = await prisma.tag.findMany({
    where: {
      users: {
        none: {},
      },
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  const userTags = await prisma.tag.findMany({
    where: {
      users: {
        some: {
          userId,
        },
      },
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return [...globalTags, ...userTags];
}

async function getSystemTemplates() {
  const templates = await prisma.appTemplate.findMany({
    where: {
      userId: undefined,
    },
    select: {
      id: true,
      name: true,
      body: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  return templates.map((tem) => ({ ...tem, userId: null }));
}

type InitialFiles = {
  imageUrls: string[];
  appFileKey?: string | null; // stored object key
  appFileSizeBytes: number | null;
  trialFileKey?: string | null; // stored object key
  trialFileSizeBytes?: number | null;
  appIconUrl: string | null;
};

async function getInitialValues(
  appPublicId: string,
  userId: number,
): Promise<{
  initialValues: BewtFormData;
  initialFiles: InitialFiles;
}> {
  const app = await prisma.app.findUnique({
    where: { publicId: appPublicId },
    include: {
      tags: true,
      salesPlans: true,
      paymentMethods: true,
      trial: true,
      images: true,
      bewtsProject: {
        select: {
          leaderId: true,
        },
      },
    },
  });

  if (!app) {
    notFound();
  }
  const isBewtsProjectApp = app.bewtsProject != null;
  const canEdit = isBewtsProjectApp
    ? app.bewtsProject?.leaderId === userId
    : app.ownerId === userId;

  if (!canEdit) {
    redirect(`/apps/${appPublicId}`);
  }

  const tagIds = app.tags.map((t) => t.tagId);

  const oneTimePlan = app.salesPlans.find((p) => p.salesFormat === "P");
  const monthlyPlan = app.salesPlans.find((p) => p.salesFormat === "S");

  const salesPlan: BewtFormData["salesPlan"] = {
    oneTimeEnabled: !!oneTimePlan,
    oneTimePrice: oneTimePlan ? oneTimePlan.price : null,
    monthlyEnabled: !!monthlyPlan,
    monthlyPrice: monthlyPlan ? monthlyPlan.price : null,
  };

  const paymentMethod: BewtFormData["paymentMethod"] = {
    wCoinEnabled: app.paymentMethods.some((pm) => pm.method === "W"),
    cardEnabled: app.paymentMethods.some((pm) => pm.method === "C"),
  };

  const trial: BewtFormData["trial"] = app.trial
    ? {
        trialEnabled: true,
        trialDays: app.trial.trialDays,
        // ファイルは編集時に再アップロードしてもらう
        trialFile: undefined as unknown as File,
      }
    : {
        trialEnabled: false,
        trialDays: undefined,
        trialFile: undefined as unknown as File,
      };

  const initialValues: BewtFormData = {
    name: app.name,
    summary: app.summary,
    description: app.description,
    tags: tagIds,
    newTagNames: [],
    images: [],
    appFile: undefined as unknown as File,
    salesPlan,
    paymentMethod,
    trial,
    appIcon: null,
  };

  const initialFiles: InitialFiles = {
    imageUrls: app.images.map((img) => img.imageUrl),
    appFileKey: (app as any).appFileKey ?? null,
    appFileSizeBytes: app.appFileSizeBytes ?? null,
    trialFileKey: app.trial ? ((app.trial as any).trialFileKey ?? null) : null,
    trialFileSizeBytes: app.trial ? 1 : undefined,
    appIconUrl: app.appIconUrl ?? null,
  };

  return { initialValues, initialFiles };
}

type EditPageProps = {
  params: Promise<{
    publicId: string;
  }>;
};

export default async function AppEditPage({ params }: EditPageProps) {
  const { publicId } = await params;

  if (!publicId || typeof publicId !== "string") {
    notFound();
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = Number.parseInt(session.user.id);

  const [tags, templates, initialData] = await Promise.all([
    getTags(userId),
    getSystemTemplates(),
    getInitialValues(publicId, userId),
  ]);

  return (
    <EditBewtForm
      tags={tags}
      templates={templates}
      appPublicId={publicId}
      initialValues={initialData.initialValues}
      initialFiles={initialData.initialFiles}
    />
  );
}
