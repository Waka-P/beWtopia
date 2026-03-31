/*
  Warnings:

  - A unique constraint covering the columns `[publicId]` on the table `chat_messages` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[publicId]` on the table `chat_rooms` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `publicId` to the `chat_messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `publicId` to the `chat_rooms` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `chat_messages` ADD COLUMN `publicId` CHAR(21) NOT NULL;

-- AlterTable
ALTER TABLE `chat_rooms` ADD COLUMN `publicId` CHAR(21) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `chat_messages_publicId_key` ON `chat_messages`(`publicId`);

-- CreateIndex
CREATE UNIQUE INDEX `chat_rooms_publicId_key` ON `chat_rooms`(`publicId`);
