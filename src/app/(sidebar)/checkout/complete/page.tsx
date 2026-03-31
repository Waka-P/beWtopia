import type { Metadata } from "next";
import PurchaseCompleteClient from "./PurchaseCompleteClient";

type PurchaseCompletePageProps = {
  searchParams?: Promise<{
    subscriptionOnly?: string;
  }>;
};

export async function generateMetadata({
  searchParams,
}: PurchaseCompletePageProps): Promise<Metadata> {
  const params = searchParams ? await searchParams : undefined;
  const isSubscriptionOnly = params?.subscriptionOnly === "1";

  return {
    title: isSubscriptionOnly
      ? "サブスク購入完了 - beWtopia"
      : "購入完了 - beWtopia",
  };
}

export default async function PurchaseCompletePage({
  searchParams,
}: PurchaseCompletePageProps) {
  const params = searchParams ? await searchParams : undefined;
  const isSubscriptionOnly = params?.subscriptionOnly === "1";

  return <PurchaseCompleteClient isSubscriptionOnly={isSubscriptionOnly} />;
}
