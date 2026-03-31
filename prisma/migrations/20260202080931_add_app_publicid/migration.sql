/*
  Warnings:

  - A unique constraint covering the columns `[publicId]` on the table `apps` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `publicId` to the `apps` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `apps` ADD COLUMN `publicId` CHAR(21) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `apps_publicId_key` ON `apps`(`publicId`);
