-- AlterTable
ALTER TABLE `bewts_join_requests` ADD COLUMN `f_bewts_role_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `bewts_join_requests` ADD CONSTRAINT `bewts_join_requests_f_bewts_role_id_fkey` FOREIGN KEY (`f_bewts_role_id`) REFERENCES `bewts_roles`(`f_bewts_role_id`) ON DELETE SET NULL ON UPDATE CASCADE;
