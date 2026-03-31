/*
  Warnings:

  - Added the required column `f_updated_at` to the `app_reviews` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `app_reviews` ADD COLUMN `f_created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `f_updated_at` DATETIME(3) NOT NULL;

-- CreateIndex
CREATE INDEX `app_reviews_f_app_id_idx` ON `app_reviews`(`f_app_id`);
