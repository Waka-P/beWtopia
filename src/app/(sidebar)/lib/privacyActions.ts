import { prisma } from "@/lib/prisma";

export type UserPrivacyActions = {
  follow: boolean;
  order: boolean;
  scout: boolean;
  tip: boolean;
};

export async function getUserPrivacyActions(
  userId: number,
): Promise<UserPrivacyActions> {
  const privacyCategories = await prisma.privacyCategory.findMany({});
  const privacySettings = await prisma.privacySetting.findMany({
    where: { userId },
  });

  const defaults: UserPrivacyActions = {
    follow: true,
    order: true,
    scout: true,
    tip: true,
  };

  const mutable: UserPrivacyActions = { ...defaults };

  const NAME_TO_PRIVACY_KEY: Record<string, keyof UserPrivacyActions> = {
    フォロー: "follow",
    オーダー: "order",
    スカウト: "scout",
    投げ銭: "tip",
  };

  for (const category of privacyCategories) {
    const key = NAME_TO_PRIVACY_KEY[category.name];
    if (!key) continue;

    const setting = privacySettings.find(
      (s) => s.privacyCategoryId === category.id,
    );

    if (setting) {
      mutable[key] = setting.isEnabled;
    }
  }

  return mutable;
}
