import { prisma } from "@/lib/prisma";
import seedJobs from "./job";
import seedPrivacyCategories from "./privacyCategory";
import seedSkills from "./skill";
import seedTags from "./tag";
import seedTemplates from "./template";
import seedUsers from "./user";

async function main() {
  const start = new Date();
  console.log("Seeding database...");

  // --- clear dependent tables in safe order to avoid foreign key errors ---
  await prisma.bewtsMessageRead.deleteMany();
  await prisma.bewtsMessageReaction.deleteMany();
  await prisma.bewtsMessageAttachment.deleteMany();
  await prisma.bewtsMessage.deleteMany();
  await prisma.bewtsRoomMember.deleteMany();
  await prisma.bewtsRoom.deleteMany();
  await prisma.bewtsJoinRequest.deleteMany();
  await prisma.bewtsPermissionCapability.deleteMany();
  await prisma.bewtsPermission.deleteMany();
  await prisma.bewtsRole.deleteMany();
  await prisma.bewtsGanttTaskSegment.deleteMany();
  await prisma.bewtsGanttTaskDependency.deleteMany();
  await prisma.bewtsGanttTask.deleteMany();
  await prisma.bewtsGanttChart.deleteMany();
  await prisma.bewtsMemo.deleteMany();
  await prisma.bewtsProject.deleteMany();

  await prisma.chatMessageRead.deleteMany();
  await prisma.chatMessageReaction.deleteMany();
  await prisma.chatMessageAttachment.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatRoomMember.deleteMany();
  await prisma.chatRoom.deleteMany();

  await prisma.checkoutItem.deleteMany();
  await prisma.checkoutSession.deleteMany();
  await prisma.purchaseHistory.deleteMany();
  await prisma.appReview.deleteMany();
  await prisma.appFavorite.deleteMany();

  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();

  await prisma.requestReaction.deleteMany();
  await prisma.requestTag.deleteMany();
  await prisma.request.deleteMany();

  await prisma.userEmojiStats.deleteMany();
  await prisma.privacySetting.deleteMany();
  await prisma.userTag.deleteMany();
  await prisma.userJob.deleteMany();
  await prisma.userSkill.deleteMany();

  await prisma.coinTransaction.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.notificationSetting.deleteMany();
  await prisma.appTemplate.deleteMany();

  // auth/account tables
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.verification.deleteMany();

  // finally users
  await prisma.user.deleteMany();
  // ---------------------------------------------------------------

  const testUser = await seedUsers(prisma);
  console.log(`Seeded user: ${testUser.email}`);

  await seedJobs(prisma);
  await seedSkills(prisma);
  await seedTags(prisma);
  await seedTemplates(prisma);
  await seedPrivacyCategories(prisma);

  const end = new Date();
  console.log(`Seeding completed: ${end.getTime() - start.getTime()}ms`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
