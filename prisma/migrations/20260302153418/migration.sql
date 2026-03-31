/*
  Warnings:

  - You are about to drop the column `f_email_notification_enabled` on the `notification_settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `notification_settings` DROP COLUMN `f_email_notification_enabled`,
    ADD COLUMN `f_bewts_chat_enabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `f_bewts_join_approved_enabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `f_bewts_join_declined_enabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `f_bewts_join_finalized_enabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `f_bewts_join_request_enabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `f_order_enabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `f_system_enabled` BOOLEAN NOT NULL DEFAULT true;
