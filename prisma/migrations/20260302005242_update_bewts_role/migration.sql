/*
  Warnings:

  - You are about to drop the column `f_user_id` on the `bewts_roles` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `bewts_roles` DROP FOREIGN KEY `bewts_roles_f_user_id_fkey`;

-- DropIndex
DROP INDEX `bewts_roles_f_user_id_idx` ON `bewts_roles`;

-- AlterTable
ALTER TABLE `bewts_roles` DROP COLUMN `f_user_id`;
