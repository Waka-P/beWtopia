/*
  Warnings:

  - Added the required column `f_updated_at` to the `apps` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `apps` ADD COLUMN `f_updated_at` DATETIME(3) NOT NULL;
