import type { PrismaClient, User } from "@/generated/prisma/client";
import { genPublicId } from "@/lib/id";
import { hashPassword } from "@/lib/password";

interface SeedUser {
  name: string;
  password: string;
  email: string;
}

const seedUsers = async (prisma: PrismaClient): Promise<User> => {
  const hashedPassword = await hashPassword("pass1234");
  // テストユーザ
  const testUser: SeedUser = {
    name: "テストピア",
    email: "testpia@example.com",
    password: hashedPassword,
  };

  const start = Date.now();
  console.log("Seeding users...");

  const user = await prisma.user.create({
    data: {
      publicId: genPublicId(),
      name: testUser.name,
      email: testUser.email,
      emailVerified: true,
    },
  });

  await prisma.account.create({
    data: {
      accountId: `${user.id}`,
      id: user.id,
      password: hashedPassword,
      providerId: "credential",
      userId: user.id,
    },
  });

  // 追加のユーザーを10人作成
  for (let i = 1; i <= 10; i++) {
    const extraUser = await prisma.user.create({
      data: {
        publicId: genPublicId(),
        name: `初期トピア${i}`,
        email: `syokitopia${i}@example.com`,
        emailVerified: true,
      },
    });

    await prisma.account.create({
      data: {
        accountId: `${extraUser.id}`,
        password: hashedPassword,
        providerId: "credential",
        userId: extraUser.id,
      },
    });
  }

  const resultTestUser = await prisma.user.findUniqueOrThrow({
    where: { email: testUser.email },
  });

  const end = Date.now();
  console.log(`Seeding users completed in ${end - start}ms`);

  return resultTestUser;
};

export default seedUsers;
