/*
  Warnings:

  - You are about to drop the column `f_trial_file_url` on the `app_trials` table. All the data in the column will be lost.
  - You are about to drop the column `f_app_file_url` on the `apps` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `app_trials` DROP COLUMN `f_trial_file_url`;

-- AlterTable
ALTER TABLE `apps` DROP COLUMN `f_app_file_url`;
