import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import RequestForm from "./components/RequestForm";

export const metadata: Metadata = {
  title: "リクエスト - 投稿",
};

export default async function NewRequestPage() {
  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <RequestForm tags={tags} />
    </div>
  );
}
