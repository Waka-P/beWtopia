/*
  Warnings:

  - You are about to drop the column `f_payment_method` on the `apps` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `apps` DROP COLUMN `f_payment_method`;

-- CreateTable
CREATE TABLE `app_payment_methods` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `f_payment_method` ENUM('W', 'C') NOT NULL,
    `f_app_id` INTEGER NOT NULL,

    UNIQUE INDEX `app_payment_methods_f_app_id_f_payment_method_key`(`f_app_id`, `f_payment_method`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `app_payment_methods` ADD CONSTRAINT `app_payment_methods_f_app_id_fkey` FOREIGN KEY (`f_app_id`) REFERENCES `apps`(`f_app_id`) ON DELETE CASCADE ON UPDATE CASCADE;
